# Fact Checker Logic Fixes (Round 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix logic defects found in the 2026-06-12 fact-checker audit: scheduled stats firing at the wrong time, immediate notifications not gated by final status, stats jobs ignoring the feature flag, missing reply/link/author in notifications, ranking and accounting errors, and digest-formatting robustness issues.

**Architecture:** Keep the existing clean-architecture shape. Scheduling fixes stay in `src/application/scheduler/`, pipeline policy fixes stay in `src/application/fact-checking/`, formatting fixes stay in `FactCheckFormatter.ts`. One new tiny shared util (`AiUsageMath.ts`) and one new dependency (`cron-parser`) for computing previous cron fire times. No DB migrations are needed.

**Tech Stack:** TypeScript, Vitest, Inversify, node-cron + cron-parser, SQLite (no schema changes), Telegram HTML.

---

## Audit Findings Driving This Plan

| #   | Severity | Defect                                                                                                                                                                                                                                                                                                                                   | Location                                                                                                                |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | High     | `reconcileOnce` inserts daily/weekly/monthly stats slots with `runAfter = now` at the start of each period, so stats fire right after midnight (or worker start) instead of at the configured cron time (default 09:00). Same root cause makes `state-evolution` sweep fire **every hour** instead of per `sweepCron` (every 3h).        | `src/application/scheduler/CronSlotScheduler.ts:102-117`                                                                |
| 2   | High     | `shouldNotifyImmediately` is persisted straight from the model even when the pipeline downgrades `confirmed` → `uncertain`, so uncertain findings can be announced as "важная фактическая ошибка". Spec: immediate replies are for _confirmed high-stakes_ errors only. The verification prompt also never defines when to set the flag. | `src/application/fact-checking/DefaultFactCheckPipeline.ts:197-235`, `prompts/fact_check_verification_system_prompt.md` |
| 3   | High     | `runStats` ignores `config.enabled` and always reports `completed`; empty "0/0" stats are sent to every approved chat; send errors are swallowed by fire-and-forget.                                                                                                                                                                     | `DefaultFactCheckPipeline.ts:314-328`, `DefaultFactCheckNotifier.ts:107-120`                                            |
| 4   | Medium   | Immediate notification does not reply to the original message (`reply_parameters`), although the spec requires it and `telegramMessageId` is available.                                                                                                                                                                                  | `DefaultFactCheckNotifier.ts:43-68`                                                                                     |
| 5   | Medium   | Digest entries omit the message link (`messageUrl` is stored but never displayed) and the author name, both required by the spec template.                                                                                                                                                                                               | `FactCheckFormatter.ts:61-76`                                                                                           |
| 6   | Medium   | Stats ranking sorts users by `confirmed + uncertain`; spec says rankings count confirmed only. Top lists are uncapped → a busy chat can exceed Telegram's 4096-char limit and the whole stats message fails.                                                                                                                             | `DefaultFactCheckStatsService.ts:53-59`                                                                                 |
| 7   | Medium   | On verification escalation, usage/latency of the first attempt is dropped — run audit undercounts tokens.                                                                                                                                                                                                                                | `DefaultFactCheckReasoningService.ts:103-167`                                                                           |
| 8   | Low      | `periodRange('monthly')` uses `setMonth(-1)` without day clamping: on Mar 31 the "from" becomes Mar 3 (Feb 31 overflow).                                                                                                                                                                                                                 | `DefaultFactCheckStatsService.ts:16-34`                                                                                 |
| 9   | Low      | Digest chunking can leave a section header (`<b>Возможные неточности</b>`) orphaned as the last element of the previous chunk.                                                                                                                                                                                                           | `FactCheckFormatter.ts:133-171`                                                                                         |
| 10  | Low      | `correctedFact`/`explanation`/`claimText` are persisted unbounded; one oversized finding makes its digest chunk permanently unsendable (retried every hour forever).                                                                                                                                                                     | `DefaultFactCheckPipeline.ts:217-249`                                                                                   |
| 11  | Low      | `escapeUrl` does not escape `<`/`>` (can break Telegram HTML); `wikipedia.org`/`britannica.com` are classified `authoritative`, which lets Wikipedia confirm _medical/legal_ claims under `primary_required`.                                                                                                                            | `FactCheckFormatter.ts:42-44`, `DefaultFactCheckSourceSearchService.ts:85-130`                                          |

Known limitations explicitly **out of scope** (documented, not fixed here): concurrent manual+scheduled `runHourly` for the same chat may double-spend AI calls (dedup absorbs the findings); source-search snippet indexes assume a single `output_text` block; `sendImmediate` limit of 10 per run stays hardcoded.

---

## File Structure

- Modify: `src/application/scheduler/CronSlotScheduler.ts` — reconcile from previous cron fire times (cron-parser).
- Modify: `src/application/fact-checking/DefaultFactCheckPipeline.ts` — gate immediate flag, honor `enabled` in `runStats`, truncate model text, use shared usage util.
- Modify: `src/application/fact-checking/FactCheckPipeline.ts` — add `skipped_no_findings` outcome.
- Modify: `src/application/fact-checking/FactCheckSourcePolicy.ts` — add `isHighStakesCategory`.
- Modify: `src/application/fact-checking/FactCheckNotifier.ts` — `sendStats` returns `Promise<boolean>`.
- Modify: `src/application/fact-checking/DefaultFactCheckNotifier.ts` — reply params, stats skip-if-empty.
- Modify: `src/application/fact-checking/FactCheckStatsService.ts` — `getStatsReport` with totals.
- Modify: `src/application/fact-checking/DefaultFactCheckStatsService.ts` — report totals, confirmed-only ranking, caps, month clamping.
- Modify: `src/application/fact-checking/DefaultFactCheckReasoningService.ts` — loop-based escalation with accumulated usage.
- Modify: `src/application/fact-checking/FactCheckFormatter.ts` — author+link line, header carry-over, URL escaping.
- Modify: `src/application/fact-checking/DefaultFactCheckSourceSearchService.ts` — export classifier, reclassify wikipedia/britannica.
- Create: `src/application/fact-checking/AiUsageMath.ts` — shared `sumAiUsage`.
- Modify: `prompts/fact_check_verification_system_prompt.md` — define `shouldNotifyImmediately` semantics.
- Tests: `test/CronSlotScheduler.test.ts`, `test/DefaultFactCheckPipeline.test.ts`, `test/DefaultFactCheckNotifier.test.ts`, `test/DefaultFactCheckStatsService.test.ts`, `test/DefaultFactCheckReasoningService.test.ts`, `test/FactCheckFormatter.test.ts`, `test/DefaultFactCheckSourceSearchService.test.ts`, `test/FactCheckSourcePolicy.test.ts`.

Task order: Task 3 must precede Task 6 and Task 8 (they call `getStatsReport`). Task 5 must precede Tasks 9 and 11 (they reuse the `makeDigestFinding` test helper introduced in Task 5). All other tasks are independent.

---

### Task 1: Reconcile Scheduled Slots From Previous Cron Fire Times

The bug: `reconcileOnce` derives slots from wall-clock `now`, so a stats slot for the current period appears (and becomes due) at the **start** of the period instead of at the cron fire time, and `state-evolution` gets a fresh hourly slot-key every hour regardless of `sweepCron`. Fix: derive reconcile slots from the _previous actual fire times_ of each cron expression, computed with `cron-parser` in the worker timezone. `runAfter` then equals the real scheduled fire time (in the past only when the fire was missed), and slot keys stay identical to the ones the live `node-cron` callbacks produce.

**Files:**

- Modify: `package.json` (new dependency)
- Modify: `src/application/scheduler/CronSlotScheduler.ts`
- Test: `test/CronSlotScheduler.test.ts`

- [ ] **Step 1: Install cron-parser**

```bash
rtk pnpm add cron-parser
```

Expected: `cron-parser` (v5.x) added to `dependencies`. Verify the v5 import compiles later in Step 4 (`import { CronExpressionParser } from 'cron-parser'`).

- [ ] **Step 2: Rewrite the reconcile tests to assert fire-time semantics**

Replace the existing `DefaultCronSlotScheduler.reconcileOnce` describe block in `test/CronSlotScheduler.test.ts` with:

```ts
describe('DefaultCronSlotScheduler.reconcileOnce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inserts slots for the last scheduled fires of each cron', async () => {
    // Monday 2026-06-08 14:30 UTC
    vi.setSystemTime(new Date('2026-06-08T14:30:00.000Z'));
    const { repo, inserted } = makeRepo();
    const scheduler = new DefaultCronSlotScheduler(config, repo, loggerFactory);

    await scheduler.reconcileOnce();

    const keys = inserted.map((s) => s.slotKey);
    // hourly cron '0 0 * * * *': last two fires are 14:00 and 13:00
    expect(keys).toContain('fact-check:2026-06-08T14');
    expect(keys).toContain('fact-check:2026-06-08T13');
    // sweep cron '0 */3 * * *': last two fires are 12:00 and 09:00
    expect(keys).toContain('state-evolution:2026-06-08T12');
    expect(keys).toContain('state-evolution:2026-06-08T09');
    // stats crons fire at 09:00 — today's fire already happened
    expect(keys).toContain('fact-check-stats:daily:2026-06-08');
    expect(keys).toContain('fact-check-stats:weekly:2026-W24');
    expect(keys).toContain('fact-check-stats:monthly:2026-06');
    expect(repo.insertDueSlot).toHaveBeenCalledWith(
      expect.anything(),
      5,
      expect.any(String)
    );
  });

  it('sets runAfter to the scheduled fire time, not the wall clock', async () => {
    vi.setSystemTime(new Date('2026-06-08T14:30:00.000Z'));
    const { repo, inserted } = makeRepo();
    const scheduler = new DefaultCronSlotScheduler(config, repo, loggerFactory);

    await scheduler.reconcileOnce();

    const daily = inserted.find((s) =>
      s.slotKey.startsWith('fact-check-stats:daily:')
    );
    expect(daily?.runAfter).toBe('2026-06-08T09:00:00.000Z');
    const hourly = inserted.find(
      (s) => s.slotKey === 'fact-check:2026-06-08T14'
    );
    expect(hourly?.runAfter).toBe('2026-06-08T14:00:00.000Z');
  });

  it('does not pre-create stats slots before their cron fire time', async () => {
    // Monday 00:30 — the 09:00 stats crons have NOT fired yet today
    vi.setSystemTime(new Date('2026-06-08T00:30:00.000Z'));
    const { repo, inserted } = makeRepo();
    const scheduler = new DefaultCronSlotScheduler(config, repo, loggerFactory);

    await scheduler.reconcileOnce();

    const dailyKeys = inserted
      .map((s) => s.slotKey)
      .filter((k) => k.startsWith('fact-check-stats:daily:'));
    // last daily fire was YESTERDAY 09:00 — today's slot must not exist yet
    expect(dailyKeys).toEqual(['fact-check-stats:daily:2026-06-07']);
    const daily = inserted.find((s) =>
      s.slotKey.startsWith('fact-check-stats:daily:')
    );
    expect(daily?.runAfter).toBe('2026-06-07T09:00:00.000Z');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
rtk npx vitest run test/CronSlotScheduler.test.ts
```

Expected: FAIL — current implementation inserts `state-evolution:2026-06-08T14`/`T13` (not `T12`/`T09`), today's daily slot at 00:30, and `runAfter` equal to the fake "now".

- [ ] **Step 4: Implement prev-fire reconciliation**

In `src/application/scheduler/CronSlotScheduler.ts` add the import:

```ts
import { CronExpressionParser } from 'cron-parser';
```

Add a private helper to `DefaultCronSlotScheduler` and replace `reconcileOnce`:

```ts
  private prevFires(cronExpr: string, count: number): Date[] {
    const interval = CronExpressionParser.parse(cronExpr, {
      tz: this.config.timezone,
    });
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      dates.push(interval.prev().toDate());
    }
    return dates;
  }

  async reconcileOnce(): Promise<void> {
    const slots: DueSlot[] = [
      ...this.prevFires(this.config.hourlyCron, 2).map((d) =>
        this.slots.hourlyFactCheck(d)
      ),
      ...this.prevFires(this.config.sweepCron, 2).map((d) =>
        this.slots.stateEvolution(d)
      ),
      ...this.prevFires(this.config.dailyStatsCron, 1).map((d) =>
        this.slots.dailyStats(d)
      ),
      ...this.prevFires(this.config.weeklyStatsCron, 1).map((d) =>
        this.slots.weeklyStats(d)
      ),
      ...this.prevFires(this.config.monthlyStatsCron, 1).map((d) =>
        this.slots.monthlyStats(d)
      ),
    ];
    for (const slot of slots) {
      await this.insert(slot);
    }
  }
```

Remove the now-unused `HOUR_MS` constant. The `SlotCalculator` itself does not change — it already derives both slot key and `runAfter` from the date passed in; reconcile now simply passes the real fire times.

- [ ] **Step 5: Run tests to verify they pass**

```bash
rtk npx vitest run test/CronSlotScheduler.test.ts test/SlotCalculator.test.ts test/ScheduledJobDispatcher.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add package.json pnpm-lock.yaml src/application/scheduler/CronSlotScheduler.ts test/CronSlotScheduler.test.ts
rtk git commit -m "fix: reconcile scheduled slots from previous cron fire times"
```

---

### Task 2: Gate Immediate Notifications On Final Confirmed High-Stakes Status

The bug: the pipeline persists the model's `shouldNotifyImmediately` verbatim, even when the pipeline itself downgrades the finding to `uncertain`, and even for low-stakes categories. Per spec, immediate replies are only for _confirmed high-stakes_ errors.

**Files:**

- Modify: `src/application/fact-checking/FactCheckSourcePolicy.ts`
- Modify: `src/application/fact-checking/DefaultFactCheckPipeline.ts`
- Modify: `prompts/fact_check_verification_system_prompt.md`
- Test: `test/FactCheckSourcePolicy.test.ts`
- Test: `test/DefaultFactCheckPipeline.test.ts`

- [ ] **Step 1: Write failing tests**

In `test/FactCheckSourcePolicy.test.ts` add (import `isHighStakesCategory` from `../src/application/fact-checking/FactCheckSourcePolicy`):

```ts
describe('isHighStakesCategory', () => {
  it('marks medical, legal, financial, safety as high stakes', () => {
    for (const category of [
      'medical',
      'legal',
      'financial',
      'safety',
    ] as const) {
      expect(isHighStakesCategory(category)).toBe(true);
    }
  });

  it('marks external_fact, chat_history, mixed as not high stakes', () => {
    for (const category of [
      'external_fact',
      'chat_history',
      'mixed',
    ] as const) {
      expect(isHighStakesCategory(category)).toBe(false);
    }
  });
});
```

In `test/DefaultFactCheckPipeline.test.ts`:

a) In the existing test `'completes successfully and persists non-no_error findings'` (claim is `external_fact`/`low`), change the assertion:

```ts
expect(findingRepo.insertFinding).toHaveBeenCalledWith(
  expect.objectContaining({ shouldNotifyImmediately: false })
);
```

b) In the existing test `'matches verifier findings to the exact extracted claim text'` (claim is `medical`/`high`, verifier returns `confirmed` + `shouldNotifyImmediately: true` + authoritative source), extend the assertion:

```ts
expect(findingRepo.insertFinding).toHaveBeenCalledWith(
  expect.objectContaining({
    category: 'medical',
    severity: 'high',
    sourcePolicy: 'primary_required',
    shouldNotifyImmediately: true,
  })
);
```

c) In the existing test `'downgrades confirmed findings when verifier source requirements are not met'`, change the verifier finding stub to ask for immediate notification (`shouldNotifyImmediately: true` instead of `false`) and extend the assertion:

```ts
expect(findingRepo.insertFinding).toHaveBeenCalledWith(
  expect.objectContaining({
    status: 'uncertain',
    sourceRequirementsMet: false,
    shouldNotifyImmediately: false,
  })
);
```

- [ ] **Step 2: Run tests to verify failures**

```bash
rtk npx vitest run test/FactCheckSourcePolicy.test.ts test/DefaultFactCheckPipeline.test.ts
```

Expected: FAIL — `isHighStakesCategory` is not exported; pipeline currently passes the model flag through (`true` in cases a and c).

- [ ] **Step 3: Implement**

In `src/application/fact-checking/FactCheckSourcePolicy.ts` add:

```ts
const HIGH_STAKES_CATEGORIES: readonly FactCheckCategory[] = [
  'medical',
  'legal',
  'financial',
  'safety',
];

export function isHighStakesCategory(category: FactCheckCategory): boolean {
  return HIGH_STAKES_CATEGORIES.includes(category);
}
```

In `src/application/fact-checking/DefaultFactCheckPipeline.ts`:

1. Extend the import from `./FactCheckSourcePolicy`:

```ts
import {
  canConfirmFinding,
  getSourcePolicyForCategory,
  isHighStakesCategory,
} from './FactCheckSourcePolicy';
```

2. After the `status` downgrade block (currently ending around line 208), compute the final flag:

```ts
const shouldNotifyImmediately =
  finding.shouldNotifyImmediately &&
  status === 'confirmed' &&
  (severity === 'high' || isHighStakesCategory(category));
```

3. In the `InsertFactCheckFindingInput` literal, replace `shouldNotifyImmediately: finding.shouldNotifyImmediately,` with:

```ts
          shouldNotifyImmediately,
```

- [ ] **Step 4: Define the flag in the verification prompt**

Append to `prompts/fact_check_verification_system_prompt.md`:

```
Set shouldNotifyImmediately to true only for confirmed findings in the
medical, legal, financial, or safety categories where acting on the error
could cause real harm. In all other cases set shouldNotifyImmediately to
false.
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
rtk npx vitest run test/FactCheckSourcePolicy.test.ts test/DefaultFactCheckPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/application/fact-checking/FactCheckSourcePolicy.ts src/application/fact-checking/DefaultFactCheckPipeline.ts prompts/fact_check_verification_system_prompt.md test/FactCheckSourcePolicy.test.ts test/DefaultFactCheckPipeline.test.ts
rtk git commit -m "fix: send immediate fact-check notifications only for confirmed high-stakes findings"
```

---

### Task 3: Make runStats Honor The Feature Flag And Skip Empty Reports

The bug: `runStats` runs even with `FACT_CHECK_ENABLED=false`, always reports `completed`, sends "0 / 0" reports to every approved chat, and swallows send failures via fire-and-forget.

**Files:**

- Modify: `src/application/fact-checking/FactCheckPipeline.ts`
- Modify: `src/application/fact-checking/FactCheckStatsService.ts`
- Modify: `src/application/fact-checking/DefaultFactCheckStatsService.ts`
- Modify: `src/application/fact-checking/FactCheckNotifier.ts`
- Modify: `src/application/fact-checking/DefaultFactCheckNotifier.ts`
- Modify: `src/application/fact-checking/DefaultFactCheckPipeline.ts`
- Test: `test/DefaultFactCheckPipeline.test.ts`
- Test: `test/DefaultFactCheckNotifier.test.ts`
- Test: `test/DefaultFactCheckStatsService.test.ts`

- [ ] **Step 1: Write failing pipeline tests**

In `test/DefaultFactCheckPipeline.test.ts`, replace the test `'runStats fires notifier and returns completed'` with:

```ts
function makeStatsPipeline(
  notifier: FactCheckNotifier,
  config = makeConfig()
): DefaultFactCheckPipeline {
  return new DefaultFactCheckPipeline(
    config,
    {} as unknown as FactCheckMessageWindowRepository,
    {} as unknown as FactCheckWindowRepository,
    {} as unknown as ChatRepository,
    {} as unknown as FactCheckReasoningService,
    {} as unknown as SourceSearchService,
    {} as unknown as FactCheckRunRepository,
    {} as unknown as FactCheckFindingRepository,
    notifier,
    makeLoggerFactory()
  );
}

it('runStats returns completed when the notifier sends a report', async () => {
  const notifier = {
    sendStats: vi.fn().mockResolvedValue(true),
  } as unknown as FactCheckNotifier;
  const result = await makeStatsPipeline(notifier).runStats(111, 'daily');
  expect(result.outcome).toBe('completed');
  expect(result.chatId).toBe(111);
  expect(notifier.sendStats).toHaveBeenCalledWith(111, 'daily');
});

it('runStats returns skipped_disabled when fact checking is disabled', async () => {
  const notifier = { sendStats: vi.fn() } as unknown as FactCheckNotifier;
  const result = await makeStatsPipeline(
    notifier,
    makeConfig({ enabled: false })
  ).runStats(111, 'daily');
  expect(result.outcome).toBe('skipped_disabled');
  expect(notifier.sendStats).not.toHaveBeenCalled();
});

it('runStats returns skipped_no_findings when there is nothing to report', async () => {
  const notifier = {
    sendStats: vi.fn().mockResolvedValue(false),
  } as unknown as FactCheckNotifier;
  const result = await makeStatsPipeline(notifier).runStats(111, 'weekly');
  expect(result.outcome).toBe('skipped_no_findings');
});

it('runStats returns failed when sending throws', async () => {
  const notifier = {
    sendStats: vi.fn().mockRejectedValue(new Error('telegram down')),
  } as unknown as FactCheckNotifier;
  const result = await makeStatsPipeline(notifier).runStats(111, 'monthly');
  expect(result.outcome).toBe('failed');
});
```

- [ ] **Step 2: Write failing notifier tests**

In `test/DefaultFactCheckNotifier.test.ts` add:

```ts
it('sendStats sends the report and returns true when there are findings', async () => {
  const statsService = {
    getStatsReport: vi.fn().mockResolvedValue({
      text: '<b>Статистика</b>',
      totalConfirmed: 2,
      totalUncertain: 1,
    }),
  } as unknown as FactCheckStatsService;
  const messenger = {
    sendMessage: vi.fn().mockResolvedValue(100),
  } as unknown as ChatMessenger;
  const notifier = new DefaultFactCheckNotifier(
    {} as unknown as FactCheckFindingRepository,
    makeConfig(),
    messenger,
    statsService,
    makeLoggerFactory()
  );

  await expect(notifier.sendStats(42, 'daily')).resolves.toBe(true);
  expect(messenger.sendMessage).toHaveBeenCalledOnce();
});

it('sendStats skips sending and returns false when there are no findings', async () => {
  const statsService = {
    getStatsReport: vi.fn().mockResolvedValue({
      text: '<b>Статистика</b>',
      totalConfirmed: 0,
      totalUncertain: 0,
    }),
  } as unknown as FactCheckStatsService;
  const messenger = {
    sendMessage: vi.fn(),
  } as unknown as ChatMessenger;
  const notifier = new DefaultFactCheckNotifier(
    {} as unknown as FactCheckFindingRepository,
    makeConfig(),
    messenger,
    statsService,
    makeLoggerFactory()
  );

  await expect(notifier.sendStats(42, 'daily')).resolves.toBe(false);
  expect(messenger.sendMessage).not.toHaveBeenCalled();
});
```

If the file has existing `sendStats` tests that mock `getStatsSummary`, update them to mock `getStatsReport` returning `{ text, totalConfirmed, totalUncertain }` instead.

- [ ] **Step 3: Run tests to verify failures**

```bash
rtk npx vitest run test/DefaultFactCheckPipeline.test.ts test/DefaultFactCheckNotifier.test.ts
```

Expected: FAIL — `getStatsReport` does not exist, `sendStats` returns `void`, `runStats` ignores `enabled` and always returns `completed`.

- [ ] **Step 4: Implement the interface changes**

`src/application/fact-checking/FactCheckStatsService.ts`:

```ts
import type { ServiceIdentifier } from 'inversify';

export interface FactCheckStatsReport {
  text: string;
  totalConfirmed: number;
  totalUncertain: number;
}

export interface FactCheckStatsService {
  getStatsReport(
    chatId: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<FactCheckStatsReport>;
}

export const FACT_CHECK_STATS_SERVICE_ID = Symbol.for(
  'FactCheckStatsService'
) as ServiceIdentifier<FactCheckStatsService>;
```

`src/application/fact-checking/FactCheckNotifier.ts` — change the `sendStats` signature:

```ts
  sendStats(
    chatId: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<boolean>;
```

`src/application/fact-checking/FactCheckPipeline.ts` — extend the outcome union:

```ts
export type FactCheckRunOutcome =
  | 'completed'
  | 'partial'
  | 'failed'
  | 'skipped_disabled'
  | 'skipped_no_messages'
  | 'skipped_no_findings';
```

- [ ] **Step 5: Implement the service, notifier, and pipeline changes**

In `src/application/fact-checking/DefaultFactCheckStatsService.ts`, rename `getStatsSummary` to `getStatsReport` and return totals (import `FactCheckStatsReport` from `./FactCheckStatsService`):

```ts
  async getStatsReport(
    chatId: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<FactCheckStatsReport> {
    const { fromIso, toIso } = periodRange(period, new Date());
    const rows = await this.statsRepo.getStats({ chatId, fromIso, toIso });

    const { confirmed, uncertain, userMap, categoryMap } =
      this.aggregateRows(rows);

    const topUsers = [...userMap.values()].sort(
      (a, b) => b.confirmed + b.uncertain - (a.confirmed + a.uncertain)
    );

    const categories = [...categoryMap.values()].sort(
      (a, b) => b.confirmed + b.uncertain - (a.confirmed + a.uncertain)
    );

    const text = formatStatsReport({
      period,
      fromIso,
      toIso,
      totalConfirmed: confirmed,
      totalUncertain: uncertain,
      topUsers,
      categories,
    });

    return { text, totalConfirmed: confirmed, totalUncertain: uncertain };
  }
```

(The sorting is intentionally unchanged here — Task 6 fixes it.)

In `src/application/fact-checking/DefaultFactCheckNotifier.ts`, replace `sendStats`:

```ts
  async sendStats(
    chatId: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<boolean> {
    const report = await this.statsService.getStatsReport(chatId, period);
    if (report.totalConfirmed + report.totalUncertain === 0) {
      return false;
    }
    await this.messenger.sendMessage(chatId, report.text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    return true;
  }
```

(The internal try/catch is removed deliberately — the pipeline now owns error handling.)

In `src/application/fact-checking/DefaultFactCheckPipeline.ts`, replace `runStats`:

```ts
  async runStats(
    chatId: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<FactCheckRunResult> {
    if (!this.config.enabled) {
      return this.skip(chatId, 'skipped_disabled');
    }
    try {
      const sent = await this.notifier.sendStats(chatId, period);
      return {
        chatId,
        outcome: sent ? 'completed' : 'skipped_no_findings',
        runId: null,
        processedMessages: 0,
        persistedFindings: 0,
      };
    } catch (err) {
      this.logger.error({ err }, 'Stats notification failed');
      return {
        chatId,
        outcome: 'failed',
        runId: null,
        processedMessages: 0,
        persistedFindings: 0,
      };
    }
  }
```

- [ ] **Step 6: Run tests, fix remaining compile errors in touched tests**

```bash
rtk npx vitest run test/DefaultFactCheckPipeline.test.ts test/DefaultFactCheckNotifier.test.ts test/DefaultFactCheckStatsService.test.ts test/JobRunner.test.ts test/JobController.test.ts
rtk pnpm type:check
```

Expected: PASS. `test/DefaultFactCheckStatsService.test.ts` will need its calls renamed from `getStatsSummary(...)` to `getStatsReport(...)`; assertions on the returned string become assertions on `result.text`.

- [ ] **Step 7: Commit**

```bash
rtk git add src/application/fact-checking test/DefaultFactCheckPipeline.test.ts test/DefaultFactCheckNotifier.test.ts test/DefaultFactCheckStatsService.test.ts
rtk git commit -m "fix: honor feature flag and skip empty reports in fact-check stats job"
```

---

### Task 4: Reply To The Original Message In Immediate Notifications

Spec: "This should be sent with `reply_to_message_id` when possible." The codebase pattern for replies is `reply_parameters` (see `src/application/behavior/DefaultBehaviorExecutor.ts:120`).

**Files:**

- Modify: `src/application/fact-checking/DefaultFactCheckNotifier.ts`
- Test: `test/DefaultFactCheckNotifier.test.ts`

- [ ] **Step 1: Write failing test**

In `test/DefaultFactCheckNotifier.test.ts` add:

```ts
it('sendImmediate replies to the original telegram message when id is known', async () => {
  const finding = { ...makeFinding(3), telegramMessageId: 555 };
  const findingRepo = {
    findUnsentImmediate: vi.fn().mockResolvedValue([finding]),
    markImmediateNotified: vi.fn().mockResolvedValue(undefined),
    recordNotificationError: vi.fn(),
  } as unknown as FactCheckFindingRepository;
  const messenger = {
    sendMessage: vi.fn().mockResolvedValue(100),
  } as unknown as ChatMessenger;

  const notifier = new DefaultFactCheckNotifier(
    findingRepo,
    makeConfig(),
    messenger,
    {} as unknown as FactCheckStatsService,
    makeLoggerFactory()
  );

  await notifier.sendImmediate(42);

  expect(messenger.sendMessage).toHaveBeenCalledWith(
    42,
    expect.any(String),
    expect.objectContaining({
      reply_parameters: { message_id: 555 },
    })
  );
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
rtk npx vitest run test/DefaultFactCheckNotifier.test.ts
```

Expected: FAIL — `reply_parameters` is not passed.

- [ ] **Step 3: Implement**

In `DefaultFactCheckNotifier.sendImmediate`, replace the `sendMessage` call with:

```ts
await this.messenger.sendMessage(chatId, text, {
  parse_mode: 'HTML',
  disable_web_page_preview: true,
  ...(finding.telegramMessageId != null
    ? { reply_parameters: { message_id: finding.telegramMessageId } }
    : {}),
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
rtk npx vitest run test/DefaultFactCheckNotifier.test.ts
```

Expected: PASS (including the pre-existing `sendImmediate` tests, whose `telegramMessageId` is `null` and therefore get no reply params).

- [ ] **Step 5: Commit**

```bash
rtk git add src/application/fact-checking/DefaultFactCheckNotifier.ts test/DefaultFactCheckNotifier.test.ts
rtk git commit -m "fix: reply to the original message in immediate fact-check notifications"
```

---

### Task 5: Show Message Link And Author In Digest Entries

Spec digest template: `<a href="message_url">Message</a> · Author`. Currently `messageUrl` is stored but never rendered, and the author is missing entirely.

**Files:**

- Modify: `src/application/fact-checking/FactCheckFormatter.ts`
- Test: `test/FactCheckFormatter.test.ts`

- [ ] **Step 1: Write failing tests**

In `test/FactCheckFormatter.test.ts` add (reuse the file's existing finding-factory helper if one exists; otherwise add this local one):

```ts
function makeDigestFinding(
  overrides: Partial<FactCheckFindingWithSources> = {}
): FactCheckFindingWithSources {
  return {
    id: 1,
    runId: 1,
    chatId: 1,
    messageId: 10,
    telegramMessageId: 555,
    authorUserId: 7,
    authorDisplayName: 'Alice <3',
    normalizedClaimKey: 'claim',
    claimText: 'The sky is green',
    originalQuote: 'The sky is green',
    correctedFact: 'The sky is blue',
    explanation: 'Basic meteorology',
    category: 'external_fact',
    severity: 'low',
    status: 'confirmed',
    confidence: 0.9,
    sourcePolicy: 'reliable_or_media_allowed',
    sourceRequirementsMet: true,
    shouldNotifyImmediately: false,
    messageUrl: 'https://t.me/c/123/555',
    immediateNotifiedAt: null,
    digestNotifiedAt: null,
    notificationError: null,
    createdAt: '2026-06-12T10:00:00.000Z',
    checkedAt: '2026-06-12T10:00:00.000Z',
    sources: [],
    ...overrides,
  };
}

describe('digest entry header', () => {
  it('links the original message and names the author', () => {
    const chunks = formatHourlyDigestChunks([makeDigestFinding()], config);
    expect(chunks[0].text).toContain(
      '<a href="https://t.me/c/123/555">Сообщение</a>'
    );
    expect(chunks[0].text).toContain('Alice &lt;3');
  });

  it('falls back to author-only header without a message url', () => {
    const chunks = formatHourlyDigestChunks(
      [makeDigestFinding({ messageUrl: null })],
      config
    );
    expect(chunks[0].text).not.toContain('<a href=""');
    expect(chunks[0].text).toContain('Alice &lt;3');
  });
});
```

(`config` is the `FactCheckConfig` fixture already present in this test file.)

- [ ] **Step 2: Run tests to verify failure**

```bash
rtk npx vitest run test/FactCheckFormatter.test.ts
```

Expected: FAIL — digest text contains neither the link nor the author.

- [ ] **Step 3: Implement**

In `src/application/fact-checking/FactCheckFormatter.ts`, replace `formatSingleFinding`:

```ts
function formatSingleFinding(
  finding: FactCheckFindingWithSources,
  maxDisplayed: number
): string {
  const label =
    finding.status === 'confirmed' ? '🔴 Подтверждено' : '🟡 Вероятно';
  const author = escapeTelegramHtml(finding.authorDisplayName);
  const headline =
    finding.messageUrl != null
      ? `${label} · <a href="${escapeUrl(finding.messageUrl)}">Сообщение</a> · ${author}`
      : `${label} · ${author}`;
  const lines = [
    headline,
    `<blockquote>${escapeTelegramHtml(finding.originalQuote)}</blockquote>`,
    `<b>Верно:</b> ${escapeTelegramHtml(finding.correctedFact)}`,
    `<b>Почему важно:</b> ${escapeTelegramHtml(finding.explanation)}`,
  ];
  const sources = formatSources(finding, maxDisplayed);
  if (sources) lines.push(sources);
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
rtk npx vitest run test/FactCheckFormatter.test.ts
```

Expected: PASS. If pre-existing digest snapshot-style assertions break, update them to include the new header line.

- [ ] **Step 5: Commit**

```bash
rtk git add src/application/fact-checking/FactCheckFormatter.ts test/FactCheckFormatter.test.ts
rtk git commit -m "fix: include message link and author in fact-check digest entries"
```

---

### Task 6: Rank Stats By Confirmed Errors Only And Cap List Sizes

Depends on Task 3 (`getStatsReport`). Spec: "Count only confirmed errors in public rankings, while showing uncertain counts separately." Also cap the lists so a busy chat cannot push the stats message past Telegram's 4096-char limit.

**Files:**

- Modify: `src/application/fact-checking/DefaultFactCheckStatsService.ts`
- Test: `test/DefaultFactCheckStatsService.test.ts`

- [ ] **Step 1: Write failing tests**

In `test/DefaultFactCheckStatsService.test.ts` add (using the file's existing repo-mock pattern; `FactCheckStatsRow` rows have `authorUserId`, `authorDisplayName`, `category`, `status`, `count`):

```ts
it('ranks users by confirmed errors only', async () => {
  const statsRepo = {
    getStats: vi.fn().mockResolvedValue([
      {
        authorUserId: 1,
        authorDisplayName: 'ManyUncertain',
        category: 'external_fact',
        status: 'uncertain',
        count: 10,
      },
      {
        authorUserId: 2,
        authorDisplayName: 'OneConfirmed',
        category: 'external_fact',
        status: 'confirmed',
        count: 1,
      },
    ]),
  } as unknown as FactCheckStatsRepository;
  const service = new DefaultFactCheckStatsService(statsRepo);

  const report = await service.getStatsReport(1, 'daily');

  const confirmedIndex = report.text.indexOf('OneConfirmed');
  const uncertainIndex = report.text.indexOf('ManyUncertain');
  expect(confirmedIndex).toBeGreaterThan(-1);
  expect(uncertainIndex).toBeGreaterThan(-1);
  expect(confirmedIndex).toBeLessThan(uncertainIndex);
});

it('caps the user ranking at 10 entries', async () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({
    authorUserId: i,
    authorDisplayName: `User${i}`,
    category: 'external_fact' as const,
    status: 'confirmed' as const,
    count: 15 - i,
  }));
  const statsRepo = {
    getStats: vi.fn().mockResolvedValue(rows),
  } as unknown as FactCheckStatsRepository;
  const service = new DefaultFactCheckStatsService(statsRepo);

  const report = await service.getStatsReport(1, 'daily');

  expect(report.text).toContain('User0');
  expect(report.text).toContain('User9');
  expect(report.text).not.toContain('User10');
  expect(report.text).not.toContain('User14');
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
rtk npx vitest run test/DefaultFactCheckStatsService.test.ts
```

Expected: FAIL — `ManyUncertain` (10 uncertain) currently outranks `OneConfirmed` (1 confirmed); the ranking is uncapped.

- [ ] **Step 3: Implement**

In `src/application/fact-checking/DefaultFactCheckStatsService.ts`, add module-level constants and replace the two sorts inside `getStatsReport`:

```ts
const MAX_STATS_USERS = 10;
const MAX_STATS_CATEGORIES = 10;
```

```ts
const topUsers = [...userMap.values()]
  .sort((a, b) => b.confirmed - a.confirmed || b.uncertain - a.uncertain)
  .slice(0, MAX_STATS_USERS);

const categories = [...categoryMap.values()]
  .sort((a, b) => b.confirmed - a.confirmed || b.uncertain - a.uncertain)
  .slice(0, MAX_STATS_CATEGORIES);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
rtk npx vitest run test/DefaultFactCheckStatsService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/application/fact-checking/DefaultFactCheckStatsService.ts test/DefaultFactCheckStatsService.test.ts
rtk git commit -m "fix: rank fact-check stats by confirmed errors and cap list sizes"
```

---

### Task 7: Accumulate Usage And Latency Across Verification Escalation

The bug: when verification escalates, the recursive `attempt()` discards the first attempt's token usage and latency, so `fact_check_runs` audit data undercounts. Extract a shared `sumAiUsage` util (the pipeline has a private copy) and rewrite the recursion as a loop that accumulates.

**Files:**

- Create: `src/application/fact-checking/AiUsageMath.ts`
- Modify: `src/application/fact-checking/DefaultFactCheckReasoningService.ts`
- Modify: `src/application/fact-checking/DefaultFactCheckPipeline.ts`
- Test: `test/DefaultFactCheckReasoningService.test.ts`

- [ ] **Step 1: Write failing test**

In `test/DefaultFactCheckReasoningService.test.ts` add (the file already has `makeEnvService`, `makePromptDirector`, `makeConfig`, `makeLoggerFactory` helpers):

```ts
it('accumulates usage across escalation attempts', async () => {
  const lowConfidence: FactVerificationResult = {
    findings: [
      {
        messageId: 1,
        claimText: 'c',
        status: 'confirmed',
        confidence: 0.5,
        correctedFact: 'x',
        explanation: 'y',
        sourceRequirementsMet: true,
        sourceIndexes: [],
        shouldNotifyImmediately: false,
      },
    ],
  };
  const highConfidence: FactVerificationResult = {
    findings: [{ ...lowConfidence.findings[0], confidence: 0.95 }],
  };
  const parseChatCompletion = vi
    .fn()
    .mockResolvedValueOnce({
      parsed: lowConfidence,
      raw: '{}',
      usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
    })
    .mockResolvedValueOnce({
      parsed: highConfidence,
      raw: '{}',
      usage: { promptTokens: 200, completionTokens: 20, totalTokens: 220 },
    });
  const gateway = { parseChatCompletion } as unknown as AiGateway;

  const service = new DefaultFactCheckReasoningService(
    makeEnvService(),
    makePromptDirector(),
    gateway,
    makeConfig(),
    makeLoggerFactory()
  );

  const result = await service.verifyClaims({
    candidates: [],
    batchMessages: [],
    contextMessages: [],
    sources: [],
  });

  expect(parseChatCompletion).toHaveBeenCalledTimes(2);
  expect(result.metadata.escalated).toBe(true);
  expect(result.metadata.escalationReason).toBe('low_confidence');
  expect(result.metadata.usage).toEqual({
    promptTokens: 300,
    completionTokens: 30,
    totalTokens: 330,
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
rtk npx vitest run test/DefaultFactCheckReasoningService.test.ts
```

Expected: FAIL — `metadata.usage` currently equals only the second attempt (`{200, 20, 220}`).

- [ ] **Step 3: Create the shared usage util**

Create `src/application/fact-checking/AiUsageMath.ts`:

```ts
import type { AiUsage } from '@/application/interfaces/ai/AiGateway';

function sumNullable(left: number | null, right: number | null): number | null {
  if (left == null && right == null) return null;
  return (left ?? 0) + (right ?? 0);
}

export function sumAiUsage(left: AiUsage, right: AiUsage): AiUsage {
  return {
    promptTokens: sumNullable(left.promptTokens, right.promptTokens),
    completionTokens: sumNullable(
      left.completionTokens,
      right.completionTokens
    ),
    totalTokens: sumNullable(left.totalTokens, right.totalTokens),
  };
}
```

- [ ] **Step 4: Rewrite verifyClaims as an accumulating loop**

In `src/application/fact-checking/DefaultFactCheckReasoningService.ts`, add the import:

```ts
import { sumAiUsage } from './AiUsageMath';
```

Replace the whole `verifyClaims` method:

```ts
  async verifyClaims(
    input: FactCheckVerificationPromptContext
  ): Promise<FactCheckAiResult<FactVerificationResult>> {
    const prompt = await this.prompts.createFactCheckVerificationPrompt(input);
    const messages = this.toAiMessages(prompt);
    const threshold = this.config.verificationConfidenceThreshold;

    let model = this.verificationModel;
    let escalated = false;
    let escalationReason: string | null = null;
    let totalLatencyMs = 0;
    let usage: AiUsage = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };

    for (;;) {
      const start = Date.now();
      const result =
        await this.gateway.parseChatCompletion<FactVerificationResult>({
          model,
          messages,
          responseFormat: factVerificationResultJsonSchema,
          parse: (content) =>
            factVerificationResultSchema.parse(JSON.parse(content) as unknown),
        });
      totalLatencyMs += Date.now() - start;
      usage = sumAiUsage(usage, result.usage);
      void this.logPrompt('factCheckVerification', messages, result.raw);

      const canEscalate = model !== this.verificationEscalationModel;

      if (result.parsed == null) {
        if (canEscalate) {
          model = this.verificationEscalationModel;
          escalated = true;
          escalationReason = 'schema_validation_failed';
          continue;
        }
        throw new Error('Failed to parse fact-check verification response');
      }

      const lowConfidence = result.parsed.findings.some(
        (f) => f.status !== 'no_error' && f.confidence < threshold
      );
      if (lowConfidence && canEscalate) {
        model = this.verificationEscalationModel;
        escalated = true;
        escalationReason = 'low_confidence';
        continue;
      }

      return {
        result: result.parsed,
        metadata: this.buildMetadata(
          'factCheckVerification',
          model,
          escalated,
          escalationReason,
          totalLatencyMs,
          usage
        ),
        requestJson: messages,
        responseJson: result.raw,
      };
    }
  }
```

- [ ] **Step 5: Deduplicate the pipeline's private copy**

In `src/application/fact-checking/DefaultFactCheckPipeline.ts`:

1. Add the import: `import { sumAiUsage } from './AiUsageMath';`
2. Replace the call `this.sumUsage(extractionResult.metadata.usage, verificationResult.metadata.usage)` with `sumAiUsage(extractionResult.metadata.usage, verificationResult.metadata.usage)`.
3. Delete the private `sumUsage` and `sumNullable` methods.

- [ ] **Step 6: Run tests to verify they pass**

```bash
rtk npx vitest run test/DefaultFactCheckReasoningService.test.ts test/DefaultFactCheckPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/application/fact-checking/AiUsageMath.ts src/application/fact-checking/DefaultFactCheckReasoningService.ts src/application/fact-checking/DefaultFactCheckPipeline.ts test/DefaultFactCheckReasoningService.test.ts
rtk git commit -m "fix: accumulate token usage and latency across fact-check verification escalation"
```

---

### Task 8: Clamp Day-Of-Month In Monthly Stats Period

The bug: `from.setMonth(from.getMonth() - 1)` on Mar 31 produces "Feb 31" → Mar 3, silently shrinking the monthly window.

**Files:**

- Modify: `src/application/fact-checking/DefaultFactCheckStatsService.ts`
- Test: `test/DefaultFactCheckStatsService.test.ts`

- [ ] **Step 1: Write failing test**

In `test/DefaultFactCheckStatsService.test.ts`, export-test `periodRange` indirectly through `getStatsReport` by asserting the repo query bounds (the repo mock receives `fromIso`):

```ts
it('monthly period clamps the day when the previous month is shorter', async () => {
  vi.useFakeTimers();
  // local-time constructor keeps the test timezone-independent
  vi.setSystemTime(new Date(2026, 2, 31, 12, 0, 0)); // March 31, 2026
  const statsRepo = {
    getStats: vi.fn().mockResolvedValue([]),
  } as unknown as FactCheckStatsRepository;
  const service = new DefaultFactCheckStatsService(statsRepo);

  await service.getStatsReport(1, 'monthly');

  const query = (statsRepo.getStats as ReturnType<typeof vi.fn>).mock
    .calls[0][0] as { fromIso: string };
  const from = new Date(query.fromIso);
  // Feb 2026 has 28 days: expected Feb 28, NOT Mar 3
  expect(from.getMonth()).toBe(1);
  expect(from.getDate()).toBe(28);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
rtk npx vitest run test/DefaultFactCheckStatsService.test.ts
```

Expected: FAIL — `from` is March 3.

- [ ] **Step 3: Implement clamped month subtraction**

In `src/application/fact-checking/DefaultFactCheckStatsService.ts`, replace the `monthly` branch of `periodRange` with a clamped helper:

```ts
function minusMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDayOfMonth));
  return result;
}
```

And in `periodRange`:

```ts
    case 'monthly':
      return { fromIso: minusMonthsClamped(now, 1).toISOString(), toIso };
```

(Adjust the surrounding `switch` accordingly — the `daily`/`weekly` branches keep mutating `from` as before and fall through to the shared `return`; the simplest refactor is:)

```ts
function periodRange(
  period: FactCheckStatsPeriod,
  now: Date
): { fromIso: string; toIso: string } {
  const toIso = now.toISOString();
  const from = new Date(now);
  switch (period) {
    case 'daily':
      from.setDate(from.getDate() - 1);
      break;
    case 'weekly':
      from.setDate(from.getDate() - 7);
      break;
    case 'monthly':
      return { fromIso: minusMonthsClamped(now, 1).toISOString(), toIso };
  }
  return { fromIso: from.toISOString(), toIso };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
rtk npx vitest run test/DefaultFactCheckStatsService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/application/fact-checking/DefaultFactCheckStatsService.ts test/DefaultFactCheckStatsService.test.ts
rtk git commit -m "fix: clamp day-of-month when computing monthly fact-check stats range"
```

---

### Task 9: Carry Orphaned Section Headers Into The Next Digest Chunk

The bug: when a chunk fills up, a section header (`<b>Возможные неточности</b>` / `<b>Фактические ошибки</b>`) already pushed into `current` stays as the **last** element of the flushed chunk, while its findings land in the next chunk.

**Files:**

- Modify: `src/application/fact-checking/FactCheckFormatter.ts`
- Test: `test/FactCheckFormatter.test.ts`

- [ ] **Step 1: Write failing test**

In `test/FactCheckFormatter.test.ts` add (reusing `makeDigestFinding` from Task 5):

```ts
it('moves a section header to the chunk that contains its findings', () => {
  const smallConfig = { ...config, maxFindingsPerDigestMessage: 2 };
  const confirmed = [1, 2].map((id) =>
    makeDigestFinding({ id, status: 'confirmed' })
  );
  const uncertain = [makeDigestFinding({ id: 3, status: 'uncertain' })];
  const chunks = formatHourlyDigestChunks(
    [...confirmed, ...uncertain],
    smallConfig
  );

  expect(chunks).toHaveLength(2);
  // header must NOT dangle at the end of chunk 0
  expect(chunks[0].text).not.toContain('Возможные неточности');
  expect(chunks[1].text).toContain('Возможные неточности');
  expect(chunks[0].findingIds).toEqual([1, 2]);
  expect(chunks[1].findingIds).toEqual([3]);
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
rtk npx vitest run test/FactCheckFormatter.test.ts
```

Expected: FAIL — chunk 0 currently ends with the orphaned header.

- [ ] **Step 3: Implement header carry-over**

In `formatHourlyDigestChunks`, replace the chunking loop (from `const chunks: FactCheckDigestChunk[] = [];` to the final `if (current.length > 0)` block) with:

```ts
const chunks: FactCheckDigestChunk[] = [];
let current: { text: string; findingId: number | null }[] = [];
let currentLen = 0;
let countInChunk = 0;

const toChunk = (
  parts: { text: string; findingId: number | null }[]
): FactCheckDigestChunk => ({
  text: parts.map((p) => p.text).join('\n\n'),
  findingIds: parts
    .map((p) => p.findingId)
    .filter((id): id is number => id != null),
});

for (const part of allParts) {
  const partLen = part.text.length + 2; // +2 for \n\n separator
  const wouldExceedCount =
    part.findingId != null &&
    countInChunk >= config.maxFindingsPerDigestMessage;
  const wouldExceedLen = currentLen + partLen > MAX_CHUNK_CHARS;

  if (current.length > 0 && (wouldExceedCount || wouldExceedLen)) {
    // never leave trailing headers behind: carry them into the next chunk
    let splitAt = current.length;
    while (splitAt > 0 && current[splitAt - 1].findingId == null) {
      splitAt--;
    }
    if (splitAt > 0) {
      const carried = current.slice(splitAt);
      chunks.push(toChunk(current.slice(0, splitAt)));
      current = carried;
      currentLen = carried.reduce((sum, p) => sum + p.text.length + 2, 0);
      countInChunk = 0;
    }
  }

  current.push(part);
  currentLen += partLen;
  if (part.findingId != null) countInChunk++;
}

if (current.length > 0) {
  chunks.push(toChunk(current));
}

return chunks;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
rtk npx vitest run test/FactCheckFormatter.test.ts
```

Expected: PASS, including pre-existing chunking tests.

- [ ] **Step 5: Commit**

```bash
rtk git add src/application/fact-checking/FactCheckFormatter.ts test/FactCheckFormatter.test.ts
rtk git commit -m "fix: carry digest section headers into the chunk with their findings"
```

---

### Task 10: Truncate Model-Generated Text Before Persisting Findings

The bug: `claimText`, `correctedFact`, and `explanation` come from the model unbounded. One oversized finding makes its digest chunk exceed Telegram's limit; the send fails every hour forever (the findings never get marked notified). `originalQuote` is already capped at 500 chars.

**Files:**

- Modify: `src/application/fact-checking/DefaultFactCheckPipeline.ts`
- Test: `test/DefaultFactCheckPipeline.test.ts`

- [ ] **Step 1: Write failing test**

In `test/DefaultFactCheckPipeline.test.ts` add a test reusing the structure of `'completes successfully and persists non-no_error findings'`, with the verifier stub returning oversized fields:

```ts
it('truncates oversized model text before persisting findings', async () => {
  const chatId = 456;
  const batchMsg = makeBatchMessage(10);
  const longText = 'x'.repeat(5000);

  const reasoning = {
    extractClaims: vi.fn().mockResolvedValue({
      result: {
        claims: [
          {
            messageId: 10,
            claimText: longText,
            category: 'external_fact',
            needsExternalSources: false,
            riskLevel: 'low',
            whyCheckable: 'long claim',
            contextMessageIds: [],
          },
        ],
      },
      metadata: {
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        escalated: false,
      },
      requestJson: {},
      responseJson: {},
    }),
    verifyClaims: vi.fn().mockResolvedValue({
      result: {
        findings: [
          {
            messageId: 10,
            claimText: longText,
            status: 'confirmed',
            confidence: 0.9,
            correctedFact: longText,
            explanation: longText,
            sourceRequirementsMet: true,
            sourceIndexes: [],
            shouldNotifyImmediately: false,
          },
        ],
      },
      metadata: {
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        escalated: false,
      },
      requestJson: {},
      responseJson: {},
    }),
  } as unknown as FactCheckReasoningService;

  const findingRepo = {
    insertFinding: vi.fn().mockResolvedValue(1),
  } as unknown as FactCheckFindingRepository;

  const pipeline = new DefaultFactCheckPipeline(
    makeConfig(),
    {
      findReadyByChatIdAfterId: vi.fn().mockResolvedValue([batchMsg]),
      findReadyContextBeforeId: vi.fn().mockResolvedValue([]),
    } as unknown as FactCheckMessageWindowRepository,
    {
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
    } as unknown as FactCheckWindowRepository,
    {
      findById: vi.fn().mockResolvedValue(undefined),
    } as unknown as ChatRepository,
    reasoning,
    { search: vi.fn().mockResolvedValue([]) } as unknown as SourceSearchService,
    {
      createRun: vi.fn().mockResolvedValue(42),
      completeRun: vi.fn().mockResolvedValue(undefined),
      failRun: vi.fn(),
    } as unknown as FactCheckRunRepository,
    findingRepo,
    {
      sendImmediate: vi.fn().mockResolvedValue(undefined),
      sendHourlyDigest: vi.fn().mockResolvedValue(undefined),
      sendStats: vi.fn(),
    } as unknown as FactCheckNotifier,
    makeLoggerFactory()
  );

  await pipeline.runHourly(chatId);

  const input = (findingRepo.insertFinding as ReturnType<typeof vi.fn>).mock
    .calls[0][0] as {
    claimText: string;
    correctedFact: string;
    explanation: string;
  };
  expect(input.claimText.length).toBeLessThanOrEqual(1000);
  expect(input.correctedFact.length).toBeLessThanOrEqual(1000);
  expect(input.explanation.length).toBeLessThanOrEqual(1000);
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
rtk npx vitest run test/DefaultFactCheckPipeline.test.ts
```

Expected: FAIL — fields are persisted at 5000 chars.

- [ ] **Step 3: Implement truncation**

In `src/application/fact-checking/DefaultFactCheckPipeline.ts`, add at module level (below imports):

```ts
const MAX_MODEL_TEXT_CHARS = 1000;

function truncateModelText(text: string): string {
  return text.length > MAX_MODEL_TEXT_CHARS
    ? `${text.slice(0, MAX_MODEL_TEXT_CHARS - 1)}…`
    : text;
}
```

Inside the findings loop, before building `input`, add:

```ts
const claimText = truncateModelText(finding.claimText);
```

And in the `InsertFactCheckFindingInput` literal replace the three fields:

```ts
          normalizedClaimKey: normalizeClaimKey(claimText),
          claimText,
          correctedFact: truncateModelText(finding.correctedFact),
          explanation: truncateModelText(finding.explanation),
```

(`findClaimForFinding` keeps matching on the raw `finding.claimText` — matching happens before truncation, so behavior is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
rtk npx vitest run test/DefaultFactCheckPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/application/fact-checking/DefaultFactCheckPipeline.ts test/DefaultFactCheckPipeline.test.ts
rtk git commit -m "fix: truncate model-generated fact-check fields before persisting"
```

---

### Task 11: Harden URL Escaping And Source Reliability Classification

Two small robustness fixes: (a) `escapeUrl` must escape `<`/`>` so a hostile URL cannot break Telegram HTML parsing; (b) `wikipedia.org`/`britannica.com` should classify as `media`, not `authoritative` — otherwise Wikipedia alone satisfies `primary_required` and can confirm medical/legal claims.

**Files:**

- Modify: `src/application/fact-checking/FactCheckFormatter.ts`
- Modify: `src/application/fact-checking/DefaultFactCheckSourceSearchService.ts`
- Test: `test/FactCheckFormatter.test.ts`
- Test: `test/DefaultFactCheckSourceSearchService.test.ts`

- [ ] **Step 1: Write failing tests**

In `test/FactCheckFormatter.test.ts` add (reusing `makeDigestFinding`; `formatImmediateFactCheck` is already exported):

```ts
it('escapes angle brackets in source URLs', () => {
  const finding = makeDigestFinding({
    sources: [
      {
        id: 1,
        findingId: 1,
        url: 'https://example.com/?q=<script>',
        title: 'Example',
        publisher: null,
        snippet: '',
        reliability: 'media',
        retrievedAt: '2026-06-12T00:00:00.000Z',
      },
    ],
  });
  const text = formatImmediateFactCheck(finding);
  expect(text).toContain('https://example.com/?q=&lt;script&gt;');
  expect(text).not.toContain('?q=<script>');
});
```

In `test/DefaultFactCheckSourceSearchService.test.ts` add (import `classifyReliability` once exported):

```ts
describe('classifyReliability', () => {
  it('classifies wikipedia and britannica as media, not authoritative', () => {
    expect(classifyReliability('https://en.wikipedia.org/wiki/X')).toBe(
      'media'
    );
    expect(classifyReliability('https://www.britannica.com/topic/X')).toBe(
      'media'
    );
  });

  it('keeps gov/edu as primary and WHO as authoritative', () => {
    expect(classifyReliability('https://www.cdc.gov/page')).toBe('primary');
    expect(classifyReliability('https://www.who.int/page')).toBe(
      'authoritative'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
rtk npx vitest run test/FactCheckFormatter.test.ts test/DefaultFactCheckSourceSearchService.test.ts
```

Expected: FAIL — `classifyReliability` is not exported; wikipedia classifies as `authoritative`; `<`/`>` are not escaped in URLs.

- [ ] **Step 3: Implement**

In `src/application/fact-checking/FactCheckFormatter.ts`, replace `escapeUrl`:

```ts
function escapeUrl(url: string): string {
  return url
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

In `src/application/fact-checking/DefaultFactCheckSourceSearchService.ts`:

1. Change `function classifyReliability` to `export function classifyReliability`.
2. Remove `'wikipedia.org'` and `'britannica.com'` from the `authoritative` array and add them to the `media` array.

- [ ] **Step 4: Run tests to verify they pass**

```bash
rtk npx vitest run test/FactCheckFormatter.test.ts test/DefaultFactCheckSourceSearchService.test.ts test/FactCheckSourcePolicy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/application/fact-checking/FactCheckFormatter.ts src/application/fact-checking/DefaultFactCheckSourceSearchService.ts test/FactCheckFormatter.test.ts test/DefaultFactCheckSourceSearchService.test.ts
rtk git commit -m "fix: escape angle brackets in URLs and stop treating wikipedia as authoritative"
```

---

### Task 12: Full Verification Gate

**Files:** none (verification only)

- [ ] **Step 1: Auto-fix formatting and lint**

```bash
rtk pnpm lint:fix
rtk pnpm format:fix
```

- [ ] **Step 2: Type check**

```bash
rtk pnpm type:check
```

Expected: no errors. Pay attention to test fixtures that still reference removed members (`getStatsSummary`, `sendStats(): Promise<void>` mocks) and fix them.

- [ ] **Step 3: Full test suite**

```bash
rtk pnpm test
```

Expected: all tests pass, including `test/factCheck.e2e.test.ts` (if the e2e asserts old digest text without the author/link header, update its expectations to the new header line from Task 5).

- [ ] **Step 4: Build**

```bash
rtk pnpm build
```

Expected: successful RSBuild compile (verifies the new `cron-parser` import bundles cleanly).

- [ ] **Step 5: Commit any verification fixes**

```bash
rtk git add -A
rtk git commit -m "chore: verification fixes after fact-checker logic round 2"
```

(Skip the commit if the working tree is clean.)

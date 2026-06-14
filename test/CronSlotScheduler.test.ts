import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory';
import type { CronWorkerConfig } from '../src/application/scheduler/CronWorkerConfig';
import { DefaultCronSlotScheduler } from '../src/application/scheduler/CronSlotScheduler';
import type { ScheduledJobRepository } from '../src/domain/repositories/ScheduledJobRepository';
import type { DueSlot } from '../src/domain/scheduler/ScheduledJobTypes';

const config: CronWorkerConfig = {
  jobsBaseUrl: 'http://app:3000',
  hourlyCron: '0 0 * * * *',
  dailyStatsCron: '0 0 9 * * *',
  weeklyStatsCron: '0 0 9 * * 1',
  monthlyStatsCron: '0 0 9 1 * *',
  sweepCron: '0 */3 * * *',
  timezone: 'UTC',
  pollIntervalMs: 5000,
  reconcileIntervalMs: 60000,
  lockMs: 600000,
  maxAttempts: 5,
  backoffBaseMs: 30000,
  jobRequestTimeoutMs: 600000,
};

const loggerFactory = {
  create: () => ({
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return this;
    },
  }),
} as unknown as LoggerFactory;

function makeRepo() {
  const inserted: DueSlot[] = [];
  const repo = {
    insertDueSlot: vi.fn(async (slot: DueSlot) => {
      inserted.push(slot);
    }),
    claimNext: vi.fn(async () => null),
    markSucceeded: vi.fn(async () => {}),
    scheduleRetry: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    findBySlot: vi.fn(async () => null),
  } as unknown as ScheduledJobRepository;
  return { repo, inserted };
}

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

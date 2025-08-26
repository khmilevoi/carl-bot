import { mkdtempSync, writeFileSync } from 'fs';
import type * as fsPromises from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TestEnvService } from '../src/infrastructure/config/TestEnvService';
import type { FilePromptService } from '../src/infrastructure/external/FilePromptService';
import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory';

class TempEnvService extends TestEnvService {
  constructor(private dir: string) {
    super();
  }

  override getPromptFiles(): {
    persona: string;
    askSummary: string;
    summarizationSystem: string;
    previousSummary: string;
    checkInterest: string;
    userPrompt: string;
    userPromptSystem: string;
    userAttitudes: string;
    userNames: string;
    priorityRulesSystem: string;
    assessUsers: string;
    replyTrigger: string;
  } {
    return {
      persona: join(this.dir, 'persona.md'),
      askSummary: join(this.dir, 'ask_summary_prompt.md'),
      summarizationSystem: join(this.dir, 'summarization_system_prompt.md'),
      previousSummary: join(this.dir, 'previous_summary_prompt.md'),
      checkInterest: join(this.dir, 'check_interest_prompt.md'),
      userPrompt: join(this.dir, 'user_prompt.md'),
      userPromptSystem: join(this.dir, 'user_prompt_system_prompt.md'),
      userAttitudes: join(this.dir, 'user_attitudes_prompt.md'),
      userNames: join(this.dir, 'user_names_prompt.md'),
      priorityRulesSystem: join(this.dir, 'priority_rules_system_prompt.md'),
      assessUsers: join(this.dir, 'assess_users_prompt.md'),
      replyTrigger: join(this.dir, 'reply_trigger_prompt.md'),
    };
  }
}

describe('FilePromptService', () => {
  let service: FilePromptService;
  let readFileSpy: ReturnType<typeof vi.fn>;
  let personaPath: string;
  let checkInterestPath: string;
  let assessUsersPath: string;
  let userPromptSystemPath: string;
  let userAttitudesPath: string;
  let userNamesPath: string;
  let summarizationPath: string;
  let previousSummaryPath: string;
  let priorityRulesPath: string;
  let replyTriggerPath: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    const dir = mkdtempSync(join(tmpdir(), 'prompts-'));
    personaPath = join(dir, 'persona.md');
    writeFileSync(personaPath, 'persona');
    writeFileSync(join(dir, 'ask_summary_prompt.md'), 'ask {{summary}}');
    summarizationPath = join(dir, 'summarization_system_prompt.md');
    writeFileSync(summarizationPath, 'summarize');
    previousSummaryPath = join(dir, 'previous_summary_prompt.md');
    writeFileSync(previousSummaryPath, 'prev {{prev}}');
    checkInterestPath = join(dir, 'check_interest_prompt.md');
    writeFileSync(checkInterestPath, 'check');
    writeFileSync(
      join(dir, 'user_prompt.md'),
      '{{messageId}}|{{userMessage}}|{{userName}}|{{fullName}}|{{replyMessage}}|{{quoteMessage}}'
    );
    userPromptSystemPath = join(dir, 'user_prompt_system_prompt.md');
    writeFileSync(userPromptSystemPath, 'system');
    userAttitudesPath = join(dir, 'user_attitudes_prompt.md');
    writeFileSync(userAttitudesPath, 'attitudes\n{{userAttitudes}}');
    userNamesPath = join(dir, 'user_names_prompt.md');
    writeFileSync(userNamesPath, 'names\n{{userNames}}');
    priorityRulesPath = join(dir, 'priority_rules_system_prompt.md');
    writeFileSync(priorityRulesPath, 'rules');
    assessUsersPath = join(dir, 'assess_users_prompt.md');
    writeFileSync(assessUsersPath, 'assess');
    replyTriggerPath = join(dir, 'reply_trigger_prompt.md');
    writeFileSync(
      replyTriggerPath,
      'trigger {{triggerReason}} {{triggerMessage}}'
    );

    const actual = await vi.importActual<typeof fsPromises>('fs/promises');
    readFileSpy = vi.fn(actual.readFile);
    vi.doMock('fs/promises', () => ({ ...actual, readFile: readFileSpy }));

    const { FilePromptService } = await import(
      '../src/infrastructure/external/FilePromptService'
    );
    const env = new TempEnvService(dir);
    const loggerFactory: LoggerFactory = {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory;
    service = new FilePromptService(env, loggerFactory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getPersona reads file only once', async () => {
    expect(await service.getPersona()).toBe('persona');
    expect(await service.getPersona()).toBe('persona');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledWith(personaPath, 'utf-8');
  });

  it('getInterestCheckPrompt reads file only once', async () => {
    expect(await service.getInterestCheckPrompt()).toBe('check');
    expect(await service.getInterestCheckPrompt()).toBe('check');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledWith(checkInterestPath, 'utf-8');
  });

  it('getAssessUsersPrompt reads file only once', async () => {
    expect(await service.getAssessUsersPrompt()).toBe('assess');
    expect(await service.getAssessUsersPrompt()).toBe('assess');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledWith(assessUsersPath, 'utf-8');
  });

  it('getAskSummaryPrompt substitutes summary', async () => {
    expect(await service.getAskSummaryPrompt('S')).toBe('ask S');
  });

  it('getUserPrompt substitutes values', async () => {
    const prompt = await service.getUserPrompt('m', 'id', 'u', 'f', 'r', 'q');
    expect(prompt).toBe('id|m|u|f|r|q');
    const prompt2 = await service.getUserPrompt('m');
    expect(prompt2).toBe('N/A|m|N/A|N/A|N/A|N/A');
  });

  it('getUserAttitudesPrompt reads file only once and formats list', async () => {
    expect(
      await service.getUserAttitudesPrompt([
        { username: 'u1', attitude: 'a1' },
        { username: 'u2', attitude: 'a2' },
      ])
    ).toBe('attitudes\nu1: a1\nu2: a2');
    expect(
      await service.getUserAttitudesPrompt([{ username: 'u1', attitude: 'a1' }])
    ).toBe('attitudes\nu1: a1');
    expect(readFileSpy).toHaveBeenCalledWith(userAttitudesPath, 'utf-8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('getUserNamesPrompt reads file only once and formats list', async () => {
    expect(
      await service.getUserNamesPrompt([
        { username: 'u1', firstName: 'F1', lastName: 'L1' },
        { username: 'u2', firstName: 'F2', lastName: 'L2' },
      ])
    ).toBe('names\nu1: F1 L1\nu2: F2 L2');
    expect(
      await service.getUserNamesPrompt([
        { username: 'u1', firstName: 'F1', lastName: 'L1' },
      ])
    ).toBe('names\nu1: F1 L1');
    expect(readFileSpy).toHaveBeenCalledWith(userNamesPath, 'utf-8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('getUserPromptSystemPrompt reads file only once', async () => {
    expect(await service.getUserPromptSystemPrompt()).toBe('system');
    expect(await service.getUserPromptSystemPrompt()).toBe('system');
    expect(readFileSpy).toHaveBeenCalledWith(userPromptSystemPath, 'utf-8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('getSummarizationSystemPrompt reads file only once', async () => {
    expect(await service.getSummarizationSystemPrompt()).toBe('summarize');
    expect(await service.getSummarizationSystemPrompt()).toBe('summarize');
    expect(readFileSpy).toHaveBeenCalledWith(summarizationPath, 'utf-8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('getPriorityRulesSystemPrompt reads file only once', async () => {
    expect(await service.getPriorityRulesSystemPrompt()).toBe('rules');
    expect(await service.getPriorityRulesSystemPrompt()).toBe('rules');
    expect(readFileSpy).toHaveBeenCalledWith(priorityRulesPath, 'utf-8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('getPreviousSummaryPrompt substitutes prev', async () => {
    expect(await service.getPreviousSummaryPrompt('A')).toBe('prev A');
    expect(await service.getPreviousSummaryPrompt('B')).toBe('prev B');
    expect(readFileSpy).toHaveBeenCalledWith(previousSummaryPath, 'utf-8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('getTriggerPrompt substitutes values', async () => {
    expect(await service.getTriggerPrompt('why', 'msg')).toBe(
      'trigger why msg'
    );
    expect(await service.getTriggerPrompt('why', 'msg')).toBe(
      'trigger why msg'
    );
    expect(readFileSpy).toHaveBeenCalledWith(replyTriggerPath, 'utf-8');
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });
});

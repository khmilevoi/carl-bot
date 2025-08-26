import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PromptFiles } from '../src/application/interfaces/env/EnvService';
import type { PromptTemplateService } from '../src/application/interfaces/prompts/PromptTemplateService';
import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory';
import { PromptBuilder } from '../src/application/prompts/PromptBuilder';
import { FilePromptTemplateService } from '../src/infrastructure/external/FilePromptTemplateService';
import { TestEnvService } from '../src/infrastructure/config/TestEnvService';

class TempEnvService extends TestEnvService {
  constructor(private dir: string) {
    super();
  }

  override getPromptFiles(): PromptFiles {
    return {
      persona: join(this.dir, 'persona.md'),
      askSummary: '',
      summarizationSystem: '',
      previousSummary: join(this.dir, 'previous_summary_prompt.md'),
      checkInterest: '',
      userPrompt: '',
      userPromptSystem: '',
      chatUser: join(this.dir, 'chat_user_prompt.md'),
      priorityRulesSystem: join(this.dir, 'priority_rules_system_prompt.md'),
      assessUsers: '',
      replyTrigger: join(this.dir, 'reply_trigger_prompt.md'),
    };
  }
}

describe('PromptBuilder', () => {
  let templateService: PromptTemplateService;

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'prompts-'));
    writeFileSync(join(dir, 'persona.md'), 'persona');
    writeFileSync(
      join(dir, 'chat_user_prompt.md'),
      'U {{userName}} {{fullName}} {{attitude}}'
    );
    writeFileSync(join(dir, 'priority_rules_system_prompt.md'), 'rules');
    writeFileSync(join(dir, 'previous_summary_prompt.md'), 'sum {{prev}}');
    writeFileSync(
      join(dir, 'reply_trigger_prompt.md'),
      'trigger {{triggerReason}} {{triggerMessage}}'
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

    templateService = new FilePromptTemplateService(env, loggerFactory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds prompt', async () => {
    const builder = new PromptBuilder(templateService);
    builder
      .addPersona()
      .addChatUsers([
        { username: 'u1', fullName: 'F1', attitude: 'a1' },
        { username: 'u2', fullName: 'F2', attitude: 'a2' },
      ])
      .addPriorityRulesSystem()
      .addPreviousSummary('S')
      .addReplyTrigger('why', 'msg');

    await expect(builder.build()).resolves.toBe(
      'persona\n\nВсе пользователи чата:\nU u1 F1 a1\n\nU u2 F2 a2\n\nrules\n\nsum S\n\ntrigger why msg'
    );
  });

  it('clears steps after build', async () => {
    const builder = new PromptBuilder(templateService);
    builder.addPersona();
    await builder.build();
    builder.addPersona();
    await expect(builder.build()).resolves.toBe('persona');
  });
});

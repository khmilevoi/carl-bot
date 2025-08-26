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
import type { ChatMessage } from '../src/domain/messages/ChatMessage';

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
      userPrompt: join(this.dir, 'user_prompt.md'),
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
    writeFileSync(join(dir, 'user_prompt.md'), 'U {{userMessage}}');

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

    await expect(builder.build()).resolves.toEqual([
      { role: 'system', content: 'persona' },
      {
        role: 'system',
        content: 'Все пользователи чата:\nU u1 F1 a1\n\nU u2 F2 a2',
      },
      { role: 'system', content: 'rules' },
      { role: 'system', content: 'sum S' },
      { role: 'system', content: 'trigger why msg' },
    ]);
  });

  it('adds messages from history', async () => {
    const builder = new PromptBuilder(templateService);
    builder.addMessages([
      { role: 'user', content: 'hi' } as ChatMessage,
      { role: 'assistant', content: 'hello' } as ChatMessage,
    ]);

    await expect(builder.build()).resolves.toEqual([
      { role: 'user', content: 'U hi' },
      { role: 'assistant', content: 'U hello' },
    ]);
  });

  it('clears steps after build', async () => {
    const builder = new PromptBuilder(templateService);
    builder.addPersona();
    await builder.build();
    builder.addPersona();
    await expect(builder.build()).resolves.toEqual([
      { role: 'system', content: 'persona' },
    ]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PromptTemplateService } from '../src/application/interfaces/prompts/PromptTemplateService';
import { PromptBuilder } from '../src/application/prompts/PromptBuilder';
import type { ChatMessage } from '../src/domain/messages/ChatMessage';

describe('PromptBuilder', () => {
  let templates: PromptTemplateService;

  beforeEach(() => {
    const map: Record<string, string> = {
      persona: 'persona',
      chatUser: 'U {{userName}} {{fullName}} {{attitude}}',
      priorityRulesSystem: 'rules',
      previousSummary: 'sum {{prev}}',
      replyTrigger: 'trigger {{triggerReason}} {{triggerMessage}}',
      userPrompt: 'U {{userMessage}}',
    };
    templates = {
      loadTemplate: vi.fn((name: string) => Promise.resolve(map[name])),
    } as unknown as PromptTemplateService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds prompt', async () => {
    const builder = new PromptBuilder(templates);
    const result = await builder
      .addPersona()
      .addChatUsers([
        { username: 'u1', fullName: 'F1', attitude: 'a1' },
        { username: 'u2', fullName: 'F2', attitude: 'a2' },
      ])
      .addPriorityRulesSystem()
      .addPreviousSummary('S')
      .addReplyTrigger('why', 'msg')
      .build();

    expect(result).toEqual([
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
    const builder = new PromptBuilder(templates);
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
    const builder = new PromptBuilder(templates);
    builder.addPersona();
    await builder.build();
    builder.addPersona();
    await expect(builder.build()).resolves.toEqual([
      { role: 'system', content: 'persona' },
    ]);
  });
});

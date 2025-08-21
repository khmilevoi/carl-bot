import { promises as fs } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from '../src/services/ai/AIService';
import type { ChatGPTService as ChatGPTServiceType } from '../src/services/ai/ChatGPTService';
import { TestEnvService } from '../src/services/env/EnvService';
import type { PromptService } from '../src/services/prompts/PromptService';
import type { LoggerFactory } from '../src/services/logging/LoggerFactory';

interface ChatGPTServiceConstructor {
  new (
    env: TestEnvService,
    prompts: PromptService,
    logger: LoggerFactory
  ): ChatGPTServiceType;
}

describe('ChatGPTService', () => {
  let ChatGPTService: ChatGPTServiceConstructor;
  let service: ChatGPTServiceType;
  let openaiCreate: ReturnType<typeof vi.fn<[], unknown>>;
  let prompts: Record<string, unknown>;
  let env: TestEnvService;
  let triggerPrompt: ReturnType<typeof vi.fn>;
  let loggerFactory: LoggerFactory;

  beforeEach(async () => {
    vi.resetModules();

    openaiCreate = vi.fn<[], unknown>();
    const openaiMock = { chat: { completions: { create: openaiCreate } } };
    vi.doMock('openai', () => ({ default: vi.fn(() => openaiMock) }));

    triggerPrompt = vi
      .fn()
      .mockImplementation(
        async (w?: string, m?: string) => `trigger:${w}:${m}`
      );

    prompts = {
      getPersona: vi.fn().mockResolvedValue('persona'),
      getPriorityRulesSystemPrompt: vi.fn().mockResolvedValue('priority'),
      getUserPromptSystemPrompt: vi.fn().mockResolvedValue('userSystem'),
      getAskSummaryPrompt: vi
        .fn()
        .mockImplementation(async (s: string) => `ask:${s}`),
      getInterestCheckPrompt: vi.fn().mockResolvedValue('interest'),
      getUserPrompt: vi
        .fn()
        .mockImplementation(async (c: string) => `user:${c}`),
      getAssessUsersPrompt: vi.fn().mockResolvedValue('assess'),
      getSummarizationSystemPrompt: vi.fn().mockResolvedValue('sumSystem'),
      getPreviousSummaryPrompt: vi
        .fn()
        .mockImplementation(async (p: string) => `prev:${p}`),
      getTriggerPrompt: triggerPrompt,
    };

    env = new TestEnvService();
    loggerFactory = {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory;
    ({ ChatGPTService } = await import('../src/services/ai/ChatGPTService'));
    service = new ChatGPTService(
      env,
      prompts as unknown as PromptService,
      loggerFactory
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_PROMPTS;
  });

  it('ask forms messages and respects triggerReason', async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'resp' } }],
    });
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'hi',
        messageId: 1,
        username: 'u',
        fullName: 'U',
        replyText: 'r',
        quoteText: 'q',
        attitude: 'good',
      },
      { role: 'assistant', content: 'yo' },
    ];
    const triggerReason = { why: 'why', message: 'msg' };
    const res = await service.ask(history, 'sum', triggerReason);
    expect(res).toBe('resp');
    expect(openaiCreate).toHaveBeenCalledTimes(1);
    expect(openaiCreate).toHaveBeenCalledWith({
      model: env.getModels().ask,
      messages: [
        { role: 'system', content: 'persona' },
        { role: 'system', content: 'priority' },
        { role: 'system', content: 'userSystem' },
        { role: 'system', content: 'ask:sum' },
        { role: 'system', content: 'trigger:why:msg' },
        { role: 'user', content: 'user:hi' },
        { role: 'assistant', content: 'yo' },
      ],
    });
    expect(triggerPrompt).toHaveBeenCalledWith('why', 'msg');
  });

  it('checkInterest parses JSON response and handles errors', async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"messageId":"1","why":"w"}' } }],
    });
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'm',
        messageId: 1,
        username: 'u',
        fullName: 'U',
      },
    ];
    const res = await service.checkInterest(history, '');
    expect(res).toEqual({ messageId: '1', why: 'w' });
    expect(openaiCreate).toHaveBeenCalledWith({
      model: env.getModels().interest,
      messages: [
        { role: 'system', content: 'persona' },
        { role: 'system', content: 'interest' },
        { role: 'user', content: 'user:m' },
      ],
    });

    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not-json' } }],
    });
    const res2 = await service.checkInterest(history, '');
    expect(res2).toBeNull();
  });

  it('assessUsers adds previous attitudes and parses response', async () => {
    openaiCreate.mockResolvedValue({
      choices: [
        {
          message: { content: '[{"username":"u","attitude":"new"}]' },
        },
      ],
    });
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'h',
        messageId: 1,
        username: 'u',
        fullName: 'U',
      },
    ];
    const res = await service.assessUsers(history, [
      { username: 'u', attitude: 'old' },
    ]);
    expect(res).toEqual([{ username: 'u', attitude: 'new' }]);
    expect(openaiCreate).toHaveBeenCalledWith({
      model: env.getModels().summary,
      messages: [
        { role: 'system', content: 'persona' },
        { role: 'system', content: 'assess' },
        {
          role: 'system',
          content: 'Предыдущее отношение бота к пользователям:\nu: old',
        },
        { role: 'user', content: 'user:h' },
      ],
    });

    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'oops' } }],
    });
    const res2 = await service.assessUsers(history);
    expect(res2).toEqual([]);
  });

  it('summarize builds history and uses previous summary', async () => {
    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: undefined } }],
    });
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'u1',
        messageId: 1,
        username: 'u',
        fullName: 'U',
      },
      { role: 'assistant', content: 'a1' },
    ];
    const res = await service.summarize(history, 'prev');
    expect(res).toBe('prev');
    expect(openaiCreate).toHaveBeenCalledWith({
      model: env.getModels().summary,
      messages: [
        { role: 'system', content: 'sumSystem' },
        { role: 'user', content: 'prev:prev' },
        {
          role: 'user',
          content: 'История диалога:\nuser:u1\nАссистент: a1',
        },
      ],
    });
  });

  it('ask without optional params and summarize without prev', async () => {
    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'resp' } }],
    });
    const resAsk = await service.ask([]);
    expect(resAsk).toBe('resp');
    expect(openaiCreate).toHaveBeenCalledWith({
      model: env.getModels().ask,
      messages: [
        { role: 'system', content: 'persona' },
        { role: 'system', content: 'priority' },
        { role: 'system', content: 'userSystem' },
      ],
    });

    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'sum' } }],
    });
    const resSum = await service.summarize([]);
    expect(resSum).toBe('sum');
    expect(openaiCreate).toHaveBeenCalledWith({
      model: env.getModels().summary,
      messages: [
        { role: 'system', content: 'sumSystem' },
        {
          role: 'user',
          content: 'История диалога:\n',
        },
      ],
    });
  });

  it('logPrompt writes only when LOG_PROMPTS=true', async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'r' } }],
    });
    const appendSpy = vi.spyOn(fs, 'appendFile').mockResolvedValue(undefined);

    const env1 = new TestEnvService();
    (env1.env as unknown as { LOG_PROMPTS: boolean }).LOG_PROMPTS = false;
    const service1 = new ChatGPTService(
      env1,
      prompts as unknown as PromptService,
      loggerFactory
    );
    await service1.ask([]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(appendSpy).not.toHaveBeenCalled();

    const env2 = new TestEnvService();
    (env2.env as unknown as { LOG_PROMPTS: boolean }).LOG_PROMPTS = true;
    const service2 = new ChatGPTService(
      env2,
      prompts as unknown as PromptService,
      loggerFactory
    );
    await service2.ask([]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(appendSpy).toHaveBeenCalled();
  });
});

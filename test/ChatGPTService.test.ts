import { promises as fs } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RabbitMQService } from '../src/application/interfaces/queue/RabbitMQService';
import type { PromptService } from '../src/application/interfaces/prompts/PromptService';
import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory';
import { TestEnvService } from '../src/infrastructure/config/TestEnvService';
import { ChatGPTService } from '../src/infrastructure/external/ChatGPTService';
import type { ChatMessage } from '../src/domain/messages/ChatMessage';
import { OPENAI_REQUEST_PRIORITY } from '../src/domain/ai/OpenAI';
import { sleep } from '../src/utils/sleep';

describe('ChatGPTService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: ChatGPTService;
  let prompts: Record<string, unknown>;
  let env: TestEnvService;
  let loggerFactory: LoggerFactory;

  beforeEach(async () => {
    vi.resetModules();
    rpc = vi.fn(async () => ({ type: 'generateMessage', body: 'ok' }));
    const rabbit: RabbitMQService = {
      publish: vi.fn(),
      consume: vi.fn(),
      rpc: rpc as unknown as RabbitMQService['rpc'],
      consumeRpc: vi.fn(),
    };

    prompts = {
      getPersona: vi.fn().mockResolvedValue('persona'),
      getPriorityRulesSystemPrompt: vi.fn().mockResolvedValue('priority'),
      getUserPromptSystemPrompt: vi.fn().mockResolvedValue('userSystem'),
      getAskSummaryPrompt: vi.fn(async (s: string) => `ask:${s}`),
      getTriggerPrompt: vi.fn(
        async (w?: string, m?: string) => `trigger:${w}:${m}`
      ),
      getUserPrompt: vi.fn(async (c: string) => `user:${c}`),
      getInterestCheckPrompt: vi.fn().mockResolvedValue('interest'),
      getAssessUsersPrompt: vi.fn().mockResolvedValue('assess'),
      getSummarizationSystemPrompt: vi.fn().mockResolvedValue('sumSystem'),
      getPreviousSummaryPrompt: vi.fn(async (p: string) => `prev:${p}`),
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

    service = new ChatGPTService(
      env,
      prompts as unknown as PromptService,
      loggerFactory,
      rabbit
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (env.env as any).LOG_PROMPTS;
  });

  it('publishes generateMessage request', async () => {
    rpc.mockResolvedValueOnce({ type: 'generateMessage', body: 'resp' });
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
    const result = await service.ask(history, 'sum', {
      why: 'why',
      message: 'msg',
    });
    expect(result).toBe('resp');
    expect(rpc).toHaveBeenCalledTimes(1);
    const [msg, priority] = rpc.mock.calls[0];
    expect(priority).toBe(OPENAI_REQUEST_PRIORITY.generateMessage);
    expect((msg as any).type).toBe('generateMessage');
    expect((msg as any).body.model).toBe(env.getModels().ask);
    expect((msg as any).body.messages).toEqual([
      { role: 'system', content: 'persona' },
      { role: 'system', content: 'priority' },
      { role: 'system', content: 'userSystem' },
      { role: 'system', content: 'ask:sum' },
      { role: 'system', content: 'trigger:why:msg' },
      { role: 'user', content: 'user:hi' },
      { role: 'assistant', content: 'yo' },
    ]);
  });

  it('publishes other request types', async () => {
    rpc.mockResolvedValueOnce({ type: 'checkInterest', body: null });
    rpc.mockResolvedValueOnce({ type: 'assessUsers', body: [] });
    rpc.mockResolvedValueOnce({ type: 'summarizeHistory', body: '' });
    await service.checkInterest([], '');
    await service.assessUsers(
      [{ role: 'user', content: 'msg' } as ChatMessage],
      [{ username: 'u', attitude: 'bad' }]
    );
    await service.summarize([{ role: 'assistant', content: 'hi' }], 'prev');
    expect(rpc).toHaveBeenCalledTimes(3);
    const types = rpc.mock.calls.map((c) => (c[0] as any).type);
    expect(types).toEqual(['checkInterest', 'assessUsers', 'summarizeHistory']);
  });

  it('logPrompt writes only when LOG_PROMPTS=true', async () => {
    const appendSpy = vi.spyOn(fs, 'appendFile').mockResolvedValue();
    rpc.mockResolvedValue({ type: 'generateMessage', body: 'ok' });

    await service.ask([]);
    await sleep(0);
    expect(appendSpy).not.toHaveBeenCalled();

    (env.env as any).LOG_PROMPTS = true;
    await service.ask([]);
    await sleep(0);
    expect(appendSpy).toHaveBeenCalled();
  });
});

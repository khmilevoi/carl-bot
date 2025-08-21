import { describe, expect, it, vi } from 'vitest';

import {
  AIService,
  ChatMessage,
} from '../src/application/interfaces/ai/AIService.interface';
import { DefaultInterestChecker } from '../src/application/use-cases/interest/DefaultInterestChecker';
import { ChatConfigService } from '../src/application/interfaces/chat/ChatConfigService.interface';
import {
  InterestMessageStore,
  InMemoryInterestMessageStore,
} from '../src/application/use-cases/messages/InMemoryInterestMessageStore';
import { SummaryService } from '../src/application/interfaces/summaries/SummaryService.interface';
import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory.interface';

const interval = 2;
const chatId = 1;

const createLoggerFactory = (): LoggerFactory =>
  ({
    create: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    }),
  }) as unknown as LoggerFactory;

function createChecker(opts: {
  count: number;
  history?: ChatMessage[];
  summary?: string;
  aiResult?: { messageId: string; why: string } | null;
}): {
  checker: DefaultInterestChecker;
  store: InterestMessageStore;
  summaries: SummaryService;
  ai: AIService;
  chatConfig: ChatConfigService;
} {
  const store: InterestMessageStore = {
    addMessage: vi.fn(),
    getMessages: vi.fn(() => []),
    getCount: vi.fn(() => opts.count),
    getLastMessages: vi.fn(() => opts.history ?? []),
    clearMessages: vi.fn(),
  } as unknown as InterestMessageStore;
  const summaries: SummaryService = {
    getSummary: vi.fn().mockResolvedValue(opts.summary),
  } as unknown as SummaryService;
  const ai: AIService = {
    checkInterest: vi.fn().mockResolvedValue(opts.aiResult ?? null),
  } as unknown as AIService;
  const chatConfig: ChatConfigService = {
    getConfig: vi.fn().mockResolvedValue({
      chatId,
      historyLimit: 0,
      interestInterval: interval,
    }),
    setHistoryLimit: vi.fn(),
    setInterestInterval: vi.fn(),
  } as unknown as ChatConfigService;
  return {
    checker: new DefaultInterestChecker(
      store,
      summaries,
      ai,
      chatConfig,
      createLoggerFactory()
    ),
    store,
    summaries,
    ai,
    chatConfig,
  };
}

describe('DefaultInterestChecker', () => {
  it('returns null when message count is not divisible by interval', async () => {
    const { checker, store, summaries, ai, chatConfig } = createChecker({
      count: 1,
    });

    const res = await checker.check(chatId);

    expect(res).toBeNull();
    expect(chatConfig.getConfig).toHaveBeenCalledWith(chatId);
    expect(store.getLastMessages).not.toHaveBeenCalled();
    expect(store.clearMessages).not.toHaveBeenCalled();
    expect(summaries.getSummary).not.toHaveBeenCalled();
    expect(ai.checkInterest).not.toHaveBeenCalled();
  });

  it('returns message and why when interested', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'hello', messageId: 1 },
      { role: 'user', content: 'world', messageId: 2 },
    ];
    const { checker, store, summaries, ai } = createChecker({
      count: 2,
      history,
      summary: 'summary',
      aiResult: { messageId: '2', why: 'because' },
    });

    const res = await checker.check(chatId);

    expect(store.getLastMessages).toHaveBeenCalledWith(chatId, interval);
    expect(store.clearMessages).toHaveBeenCalledWith(chatId);
    expect(summaries.getSummary).toHaveBeenCalledWith(chatId);
    expect(ai.checkInterest).toHaveBeenCalledWith(history, 'summary');
    expect(res).toEqual({ messageId: '2', message: 'world', why: 'because' });
  });

  it('returns null when AIService returns null', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'msg1', messageId: 1 },
      { role: 'user', content: 'msg2', messageId: 2 },
    ];
    const { checker, store } = createChecker({
      count: 2,
      history,
      summary: 'summary',
      aiResult: null,
    });

    const res = await checker.check(chatId);
    expect(res).toBeNull();
    expect(store.clearMessages).toHaveBeenCalledWith(chatId);
  });

  it('uses empty message when ID not found', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'msg1', messageId: 1 },
    ];
    const { checker, store } = createChecker({
      count: 2,
      history,
      summary: '',
      aiResult: { messageId: '42', why: 'w' },
    });
    const res = await checker.check(chatId);
    expect(res).toEqual(null);
    expect(store.clearMessages).toHaveBeenCalledWith(chatId);
  });

  it('clears stored messages after checking', async () => {
    const store = new InMemoryInterestMessageStore(createLoggerFactory());
    store.addMessage({ chatId, role: 'user', content: 'hi', messageId: 1 });
    const checker = new DefaultInterestChecker(
      store,
      {
        getSummary: vi.fn().mockResolvedValue(''),
      } as unknown as SummaryService,
      {
        checkInterest: vi.fn().mockResolvedValue(null),
      } as unknown as AIService,
      {
        getConfig: vi
          .fn()
          .mockResolvedValue({ chatId, historyLimit: 0, interestInterval: 1 }),
        setHistoryLimit: vi.fn(),
        setInterestInterval: vi.fn(),
      } as unknown as ChatConfigService,
      createLoggerFactory()
    );

    await checker.check(chatId);
    expect(store.getCount(chatId)).toBe(0);
  });
});

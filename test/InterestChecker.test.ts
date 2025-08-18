import { describe, expect, it, vi } from 'vitest';

import { AIService, ChatMessage } from '../src/services/ai/AIService.interface';
import { EnvService } from '../src/services/env/EnvService';
import { DefaultInterestChecker } from '../src/services/interest/InterestChecker';
import { InterestMessageStore } from '../src/services/messages/InterestMessageStore';
import { SummaryService } from '../src/services/summaries/SummaryService.interface';

const interval = 2;
const chatId = 1;

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
  const env: EnvService = {
    env: {
      INTEREST_MESSAGE_INTERVAL: interval,
    } as unknown as EnvService['env'],
  } as EnvService;

  return {
    checker: new DefaultInterestChecker(store, summaries, ai, env),
    store,
    summaries,
    ai,
  };
}

describe('DefaultInterestChecker', () => {
  it('returns null when message count is not divisible by interval', async () => {
    const { checker, store, summaries, ai } = createChecker({ count: 1 });

    const res = await checker.check(chatId);

    expect(res).toBeNull();
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
});

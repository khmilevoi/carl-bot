import { describe, expect, it, vi } from 'vitest';

import { AIService, ChatMessage } from '../src/services/ai/AIService';
import { EnvService } from '../src/services/env/EnvService';
import { DefaultInterestChecker } from '../src/services/interest/InterestChecker';
import { MessageService } from '../src/services/messages/MessageService';
import { SummaryService } from '../src/services/summaries/SummaryService';

const interval = 2;
const chatId = 1;

function createChecker(opts: {
  count: number;
  history?: ChatMessage[];
  summary?: string;
  aiResult?: { messageId: string; why: string } | null;
}) {
  const messages: MessageService = {
    getCount: vi.fn().mockResolvedValue(opts.count),
    getLastMessages: vi.fn().mockResolvedValue(opts.history ?? []),
  } as unknown as MessageService;
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
    checker: new DefaultInterestChecker(messages, summaries, ai, env),
    messages,
    summaries,
    ai,
  };
}

describe('DefaultInterestChecker', () => {
  it('returns null when message count is not divisible by interval', async () => {
    const { checker, messages, summaries, ai } = createChecker({ count: 3 });

    const res = await checker.check(chatId);

    expect(res).toBeNull();
    expect(messages.getLastMessages).not.toHaveBeenCalled();
    expect(summaries.getSummary).not.toHaveBeenCalled();
    expect(ai.checkInterest).not.toHaveBeenCalled();
  });

  it('returns message and why when interested', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'hello', messageId: 1 },
      { role: 'user', content: 'world', messageId: 2 },
    ];
    const { checker, messages, summaries, ai } = createChecker({
      count: 4,
      history,
      summary: 'summary',
      aiResult: { messageId: '2', why: 'because' },
    });

    const res = await checker.check(chatId);

    expect(messages.getLastMessages).toHaveBeenCalledWith(chatId, interval);
    expect(summaries.getSummary).toHaveBeenCalledWith(chatId);
    expect(ai.checkInterest).toHaveBeenCalledWith(history, 'summary');
    expect(res).toEqual({ messageId: '2', message: 'world', why: 'because' });
  });

  it('returns null when AIService returns null', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'msg1', messageId: 1 },
      { role: 'user', content: 'msg2', messageId: 2 },
    ];
    const { checker } = createChecker({
      count: 4,
      history,
      summary: 'summary',
      aiResult: null,
    });

    const res = await checker.check(chatId);
    expect(res).toBeNull();
  });
});

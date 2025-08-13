import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../src/services/ai/AIService';
import { DefaultHistorySummarizer } from '../src/services/chat/HistorySummarizer';
import { MessageService } from '../src/services/messages/MessageService';
import { SummaryService } from '../src/services/summaries/SummaryService';

class MockAIService {
  summarize = vi.fn(async () => 'new summary');
}

class MockMessageService implements MessageService {
  messages: ChatMessage[] = [];

  async addMessage(msg: any): Promise<void> {
    this.messages.push(msg);
  }

  async getMessages(_chatId: number): Promise<ChatMessage[]> {
    return [...this.messages];
  }

  async getCount(): Promise<number> {
    return this.messages.length;
  }

  async getLastMessages(_: number, limit: number): Promise<ChatMessage[]> {
    return [...this.messages].slice(-limit).reverse();
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
  }
}

class MockSummaryService implements SummaryService {
  summary = '';

  async getSummary(): Promise<string> {
    return this.summary;
  }

  async setSummary(_: number, summary: string): Promise<void> {
    this.summary = summary;
  }

  async clearSummary(): Promise<void> {
    this.summary = '';
  }
}

describe('HistorySummarizer', () => {
  let ai: MockAIService;
  let messages: MockMessageService;
  let summaries: MockSummaryService;
  let summarizer: DefaultHistorySummarizer;

  beforeEach(() => {
    ai = new MockAIService();
    messages = new MockMessageService();
    summaries = new MockSummaryService();
    summarizer = new DefaultHistorySummarizer(ai as any, summaries, messages);
  });

  it('does not summarize when history is within limit', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'message 1' },
      { role: 'assistant', content: 'response 1' },
    ];

    await summarizer.summarizeIfNeeded(1, history, 3);

    expect(ai.summarize).not.toHaveBeenCalled();
    expect(messages.messages).toHaveLength(0);
  });

  it('summarizes and clears messages when history exceeds limit', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'message 1' },
      { role: 'assistant', content: 'response 1' },
      { role: 'user', content: 'message 2' },
      { role: 'assistant', content: 'response 2' },
      { role: 'user', content: 'message 3' },
    ];

    await summarizer.summarizeIfNeeded(1, history, 3);

    expect(ai.summarize).toHaveBeenCalledWith(history, '');
    expect(summaries.summary).toBe('new summary');
    expect(messages.messages).toHaveLength(0);
  });

  it('preserves existing summary when creating new one', async () => {
    summaries.summary = 'existing summary';

    const history: ChatMessage[] = [
      { role: 'user', content: 'message 1' },
      { role: 'assistant', content: 'response 1' },
      { role: 'user', content: 'message 2' },
    ];

    await summarizer.summarizeIfNeeded(1, history, 2);

    expect(ai.summarize).toHaveBeenCalledWith(history, 'existing summary');
  });
});

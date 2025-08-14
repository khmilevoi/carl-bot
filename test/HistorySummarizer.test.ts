import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  UserEntity,
  UserRepository,
} from '../src/repositories/interfaces/UserRepository';
import type { AIService, ChatMessage } from '../src/services/ai/AIService';
import { DefaultHistorySummarizer } from '../src/services/chat/HistorySummarizer';
import type { MessageService } from '../src/services/messages/MessageService';
import type { SummaryService } from '../src/services/summaries/SummaryService';

class MockAIService implements AIService {
  summarize = vi.fn(async () => 'new summary');
  assessUsers = vi.fn(
    async (
      _msgs: ChatMessage[],
      _prev?: { username: string; attitude: string }[]
    ) => {
      return [{ username: 'user1', attitude: 'positive' }];
    }
  );
}

class MockMessageService implements MessageService {
  messages: ChatMessage[] = [];

  async addMessage(msg: ChatMessage): Promise<void> {
    this.messages.push(msg);
  }

  async getMessages(_chatId: number): Promise<ChatMessage[]> {
    return [...this.messages];
  }

  async getCount(): Promise<number> {
    return this.messages.length;
  }

  async getLastMessages(
    _chatId: number,
    limit: number
  ): Promise<ChatMessage[]> {
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

  async setSummary(_chatId: number, summary: string): Promise<void> {
    this.summary = summary;
  }

  async clearSummary(): Promise<void> {
    this.summary = '';
  }
}

class MockUserRepository implements UserRepository {
  updates: { userId: number; attitude: string }[] = [];
  attitudes = new Map<number, string>();
  async setAttitude(userId: number, attitude: string): Promise<void> {
    this.updates.push({ userId, attitude });
  }
  async upsert(_user: UserEntity): Promise<void> {}
  async findById(id: number): Promise<UserEntity | undefined> {
    const attitude = this.attitudes.get(id);
    return attitude ? { id, attitude } : undefined;
  }
}

describe('HistorySummarizer', () => {
  let ai: MockAIService;
  let messages: MockMessageService;
  let summaries: MockSummaryService;
  let summarizer: DefaultHistorySummarizer;
  let users: MockUserRepository;

  beforeEach(() => {
    ai = new MockAIService();
    messages = new MockMessageService();
    summaries = new MockSummaryService();
    users = new MockUserRepository();
    users.attitudes.set(1, 'neutral');
    users.attitudes.set(2, 'hostile');
    summarizer = new DefaultHistorySummarizer(ai, summaries, messages, users);
  });

  it('does not summarize when history is within limit', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'message 1' },
      { role: 'assistant', content: 'response 1' },
    ];

    const summarized = await summarizer.summarize(1, history, 3);

    expect(summarized).toBe(false);
    expect(ai.summarize).not.toHaveBeenCalled();
    expect(ai.assessUsers).not.toHaveBeenCalled();
    expect(messages.messages).toHaveLength(0);
    expect(users.updates).toHaveLength(0);
  });

  it('summarizes and clears messages when history exceeds limit', async () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'message 1', username: 'user1', userId: 1 },
      { role: 'assistant', content: 'response 1' },
      { role: 'user', content: 'message 2', username: 'user2', userId: 2 },
      { role: 'assistant', content: 'response 2' },
      { role: 'user', content: 'message 3', username: 'user1', userId: 1 },
    ];

    const summarized = await summarizer.summarize(1, history, 3);
    expect(summarized).toBe(true);
    await summarizer.assessUsers(1, history);

    expect(ai.summarize).toHaveBeenCalledWith(history, '');
    expect(ai.assessUsers).toHaveBeenCalledWith(history, [
      { username: 'user1', attitude: 'neutral' },
      { username: 'user2', attitude: 'hostile' },
    ]);
    expect(summaries.summary).toBe('new summary');
    expect(users.updates).toEqual([{ userId: 1, attitude: 'positive' }]);
    expect(messages.messages).toHaveLength(0);
  });

  it('preserves existing summary when creating new one', async () => {
    summaries.summary = 'existing summary';

    const history: ChatMessage[] = [
      { role: 'user', content: 'message 1' },
      { role: 'assistant', content: 'response 1' },
      { role: 'user', content: 'message 2' },
    ];

    await summarizer.summarize(1, history, 2);

    expect(ai.summarize).toHaveBeenCalledWith(history, 'existing summary');
  });
});

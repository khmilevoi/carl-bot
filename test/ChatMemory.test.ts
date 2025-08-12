import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService, ChatMessage } from '../src/services/ai/AIService';
import { ChatMemory } from '../src/services/chat/ChatMemory';
import { MessageService } from '../src/services/messages/MessageService';
import { SummaryService } from '../src/services/summaries/SummaryService';

class FakeAI implements AIService {
  ask = vi.fn(async () => 'ok');
  summarize = vi.fn(async (_h: ChatMessage[]) => 'summary');
}

class FakeMessageService implements MessageService {
  private data = new Map<number, ChatMessage[]>();

  async addMessage(
    chatId: number,
    role: 'user' | 'assistant',
    content: string,
    username?: string,
    fullName?: string,
    replyText?: string,
    replyUsername?: string,
    quoteText?: string,
    userId?: number,
    messageId?: number,
    firstName?: string,
    lastName?: string,
    chatTitle?: string
  ) {
    const list = this.data.get(chatId) ?? [];
    const entry: ChatMessage = { role, content, chatId };
    if (username) entry.username = username;
    if (fullName) entry.fullName = fullName;
    if (replyText) entry.replyText = replyText;
    if (replyUsername) entry.replyUsername = replyUsername;
    if (quoteText) entry.quoteText = quoteText;
    if (userId !== undefined) entry.userId = userId;
    if (messageId !== undefined) entry.messageId = messageId;
    list.push(entry);
    this.data.set(chatId, list);
  }

  async getMessages(chatId: number) {
    return this.data.get(chatId) ?? [];
  }

  async clearMessages(chatId: number) {
    this.data.set(chatId, []);
  }
}

class FakeSummaryService implements SummaryService {
  private data = new Map<number, string>();

  async getSummary(chatId: number) {
    return this.data.get(chatId) ?? '';
  }

  async setSummary(chatId: number, summary: string) {
    this.data.set(chatId, summary);
  }

  async clearSummary(chatId: number) {
    this.data.delete(chatId);
  }
}

describe('ChatMemory', () => {
  let ai: FakeAI;
  let messages: FakeMessageService;
  let summaries: FakeSummaryService;
  let memory: ChatMemory;

  beforeEach(() => {
    ai = new FakeAI();
    messages = new FakeMessageService();
    summaries = new FakeSummaryService();
    memory = new ChatMemory(ai, messages, summaries, 1, 2);
  });

  it('summarizes when history exceeds limit', async () => {
    await memory.addMessage('user', 'm1', 'u1');
    await memory.addMessage('assistant', 'm2', 'bot');
    await memory.addMessage('user', 'm3', 'u1');
    expect(ai.summarize).not.toHaveBeenCalled();

    await memory.addMessage('assistant', 'm4', 'bot');
    expect(ai.summarize).toHaveBeenCalledOnce();
    expect(await memory.getSummary()).toBe('summary');
    const hist = await memory.getHistory();
    expect(hist).toEqual([
      { role: 'assistant', content: 'm4', username: 'bot', chatId: 1 },
    ]);
  });

  it('stores user and message ids', async () => {
    await memory.addMessage(
      'user',
      'hello',
      'alice',
      undefined,
      undefined,
      undefined,
      undefined,
      7,
      42
    );
    const hist = await memory.getHistory();
    expect(hist).toEqual([
      {
        role: 'user',
        content: 'hello',
        username: 'alice',
        userId: 7,
        messageId: 42,
        chatId: 1,
      },
    ]);
  });
});

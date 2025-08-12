import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIService, ChatMessage } from '../src/services/ai/AIService';
import { ChatMemory } from '../src/services/chat/ChatMemory';
import { MessageService } from '../src/services/messages/MessageService';
import { StoredMessage } from '../src/services/messages/StoredMessage';
import { SummaryService } from '../src/services/summaries/SummaryService';

class FakeAI implements AIService {
  ask = vi.fn(async () => 'ok');
  summarize = vi.fn(async (_h: ChatMessage[]) => 'summary');
}

class FakeMessageService implements MessageService {
  private data = new Map<number, ChatMessage[]>();

  async addMessage(message: StoredMessage) {
    const list = this.data.get(message.chatId) ?? [];
    const entry: ChatMessage = {
      role: message.role,
      content: message.content,
      chatId: message.chatId,
    };
    if (message.username) entry.username = message.username;
    if (message.fullName) entry.fullName = message.fullName;
    if (message.replyText) entry.replyText = message.replyText;
    if (message.replyUsername) entry.replyUsername = message.replyUsername;
    if (message.quoteText) entry.quoteText = message.quoteText;
    if (message.userId !== undefined) entry.userId = message.userId;
    if (message.messageId !== undefined) entry.messageId = message.messageId;
    list.push(entry);
    this.data.set(message.chatId, list);
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
    await memory.addMessage({
      chatId: 1,
      role: 'user',
      content: 'm1',
      username: 'u1',
    });
    await memory.addMessage({
      chatId: 1,
      role: 'assistant',
      content: 'm2',
      username: 'bot',
    });
    await memory.addMessage({
      chatId: 1,
      role: 'user',
      content: 'm3',
      username: 'u1',
    });
    expect(ai.summarize).not.toHaveBeenCalled();

    await memory.addMessage({
      chatId: 1,
      role: 'assistant',
      content: 'm4',
      username: 'bot',
    });
    expect(ai.summarize).toHaveBeenCalledOnce();
    expect(await memory.getSummary()).toBe('summary');
    const hist = await memory.getHistory();
    expect(hist).toEqual([
      { role: 'assistant', content: 'm4', username: 'bot', chatId: 1 },
    ]);
  });

  it('stores user and message ids', async () => {
    await memory.addMessage({
      chatId: 1,
      role: 'user',
      content: 'hello',
      username: 'alice',
      userId: 7,
      messageId: 42,
    });
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

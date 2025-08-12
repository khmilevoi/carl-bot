import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../src/services/ai/AIService';
import { ChatMemory } from '../src/services/chat/ChatMemory';
import { HistorySummarizer } from '../src/services/chat/HistorySummarizer';
import { MessageService } from '../src/services/messages/MessageService';
import { StoredMessage } from '../src/services/messages/StoredMessage';

class FakeHistorySummarizer implements HistorySummarizer {
  summarizeIfNeeded = vi.fn(async () => {});
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
    const list = this.data.get(chatId) ?? [];
    return list.map((m) => ({ ...m }));
  }

  async clearMessages(chatId: number) {
    this.data.set(chatId, []);
  }
}

describe('ChatMemory', () => {
  let summarizer: FakeHistorySummarizer;
  let messages: FakeMessageService;
  let memory: ChatMemory;

  beforeEach(() => {
    summarizer = new FakeHistorySummarizer();
    messages = new FakeMessageService();
    memory = new ChatMemory(messages, summarizer, 1, 2);
  });

  it('passes history to summarizer before saving message', async () => {
    await messages.addMessage({
      chatId: 1,
      role: 'user',
      content: 'old',
      username: 'u1',
    });

    await memory.addMessage({
      chatId: 1,
      role: 'assistant',
      content: 'new',
      username: 'bot',
    });

    expect(summarizer.summarizeIfNeeded).toHaveBeenCalledWith(
      1,
      [
        {
          role: 'user',
          content: 'old',
          username: 'u1',
          chatId: 1,
        },
      ],
      2
    );
    const hist = await memory.getHistory();
    expect(hist).toEqual([
      { role: 'user', content: 'old', username: 'u1', chatId: 1 },
      { role: 'assistant', content: 'new', username: 'bot', chatId: 1 },
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../src/services/ai/AIService.interface';
import { ChatMemory, ChatMemoryManager } from '../src/services/chat/ChatMemory';
import { ChatResetService } from '../src/services/chat/ChatResetService.interface';
import { HistorySummarizer } from '../src/services/chat/HistorySummarizer';
import { EnvService } from '../src/services/env/EnvService';
import { MessageService } from '../src/services/messages/MessageService.interface';
import { LocalMessageStore } from '../src/services/messages/LocalMessageStore';
import { StoredMessage } from '../src/services/messages/StoredMessage.interface';

class FakeHistorySummarizer implements HistorySummarizer {
  summarize = vi.fn(async () => false);
  assessUsers = vi.fn(async () => {});
}

class FakeMessageService implements MessageService {
  private data = new Map<number, ChatMessage[]>();

  async addMessage(message: StoredMessage): Promise<void> {
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

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    const list = this.data.get(chatId) ?? [];
    return list.map((m) => ({ ...m }));
  }

  async getCount(chatId: number): Promise<number> {
    return (this.data.get(chatId) ?? []).length;
  }

  async getLastMessages(chatId: number, limit: number): Promise<ChatMessage[]> {
    const list = this.data.get(chatId) ?? [];
    return list
      .slice(-limit)
      .reverse()
      .map((m) => ({ ...m }));
  }

  async clearMessages(chatId: number): Promise<void> {
    this.data.set(chatId, []);
  }
}

class FakeLocalMessageStore implements LocalMessageStore {
  addMessage = vi.fn();
  getMessages = vi.fn(() => []);
  getCount = vi.fn(() => 0);
  getLastMessages = vi.fn(() => []);
  clearMessages = vi.fn();
}

describe('ChatMemory', () => {
  let summarizer: FakeHistorySummarizer;
  let messages: FakeMessageService;
  let localStore: FakeLocalMessageStore;
  let memory: ChatMemory;

  beforeEach(() => {
    summarizer = new FakeHistorySummarizer();
    messages = new FakeMessageService();
    localStore = new FakeLocalMessageStore();
    memory = new ChatMemory(messages, summarizer, localStore, 1, 2);
  });

  it('passes history to summarizer after saving message', async () => {
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

    expect(summarizer.summarize).toHaveBeenCalledWith(
      1,
      [
        {
          role: 'user',
          content: 'old',
          username: 'u1',
          chatId: 1,
        },
        {
          role: 'assistant',
          content: 'new',
          username: 'bot',
          chatId: 1,
        },
      ],
      2
    );
    expect(summarizer.assessUsers).not.toHaveBeenCalled();
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

  it('assesses users when summarizer returns true', async () => {
    summarizer.summarize.mockResolvedValue(true);
    await memory.addMessage({
      chatId: 1,
      role: 'user',
      content: 'msg',
    });
    expect(summarizer.assessUsers).toHaveBeenCalledWith(1, [
      { role: 'user', content: 'msg', chatId: 1 },
    ]);
  });

  it('stores messages in LocalMessageStore', async () => {
    const msg: StoredMessage = { chatId: 1, role: 'user', content: 'hi' };
    await memory.addMessage(msg);
    expect(localStore.addMessage).toHaveBeenCalledWith({ ...msg, chatId: 1 });
  });
});

describe('ChatMemoryManager', () => {
  class DummyResetService implements ChatResetService {
    reset = vi.fn(async () => {});
  }
  class DummyEnvService implements EnvService {
    env = { CHAT_HISTORY_LIMIT: 2 } as EnvService['env'];
  }
  class DummyLocalMessageStore implements LocalMessageStore {
    addMessage = vi.fn();
    getMessages = vi.fn(() => []);
    getCount = vi.fn(() => 0);
    getLastMessages = vi.fn(() => []);
    clearMessages = vi.fn();
  }

  it('creates ChatMemory with limit from env', () => {
    const manager = new ChatMemoryManager(
      new FakeMessageService(),
      new FakeHistorySummarizer(),
      new DummyResetService(),
      new DummyLocalMessageStore(),
      new DummyEnvService()
    );
    const mem = manager.get(5);
    expect(mem).toBeInstanceOf(ChatMemory);
  });

  it('resets memory using ChatResetService', async () => {
    const reset = new DummyResetService();
    const local = new DummyLocalMessageStore();
    const manager = new ChatMemoryManager(
      new FakeMessageService(),
      new FakeHistorySummarizer(),
      reset,
      local,
      new DummyEnvService()
    );
    await manager.reset(7);
    expect(reset.reset).toHaveBeenCalledWith(7);
    expect(local.clearMessages).toHaveBeenCalledWith(7);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../src/services/ai/AIService.interface';
import { ChatMemory, ChatMemoryManager } from '../src/services/chat/ChatMemory';
import { ChatResetService } from '../src/services/chat/ChatResetService.interface';
import { HistorySummarizer } from '../src/services/chat/HistorySummarizer';
import type { ChatConfigService } from '../src/services/chat/ChatConfigService';
import type { ChatConfigEntity } from '../src/repositories/interfaces/ChatConfigRepository.interface';
import {
  InterestMessageStore,
  InterestMessageStoreImpl,
} from '../src/services/messages/InterestMessageStore';
import { MessageService } from '../src/services/messages/MessageService.interface';
import { StoredMessage } from '../src/services/messages/StoredMessage.interface';
import type { LoggerFactory } from '../src/services/logging/LoggerFactory';

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

class FakeHistorySummarizer implements HistorySummarizer {
  summarize = vi.fn(async () => false);
  assessUsers = vi.fn(async () => {});
}

class FakeMessageService
  extends InterestMessageStoreImpl
  implements MessageService
{
  constructor() {
    super(createLoggerFactory());
  }

  async addMessage(message: StoredMessage): Promise<void> {
    super.addMessage(message);
  }

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    return super.getMessages(chatId);
  }

  async getCount(chatId: number): Promise<number> {
    return super.getCount(chatId);
  }

  async getLastMessages(chatId: number, limit: number): Promise<ChatMessage[]> {
    return super.getLastMessages(chatId, limit).reverse();
  }

  async clearMessages(chatId: number): Promise<void> {
    super.clearMessages(chatId);
  }
}

class FakeInterestMessageStore implements InterestMessageStore {
  addMessage = vi.fn();
  getMessages = vi.fn(() => []);
  getCount = vi.fn(() => 0);
  getLastMessages = vi.fn(() => []);
  clearMessages = vi.fn();
}

describe('ChatMemory', () => {
  let summarizer: FakeHistorySummarizer;
  let messages: FakeMessageService;
  let localStore: FakeInterestMessageStore;
  let memory: ChatMemory;

  beforeEach(() => {
    summarizer = new FakeHistorySummarizer();
    messages = new FakeMessageService();
    localStore = new FakeInterestMessageStore();
    memory = new ChatMemory(
      messages,
      summarizer,
      localStore,
      1,
      2,
      createLoggerFactory()
    );
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

  it('stores messages in InterestMessageStore', async () => {
    const msg: StoredMessage = { chatId: 1, role: 'user', content: 'hi' };
    await memory.addMessage(msg);
    expect(localStore.addMessage).toHaveBeenCalledWith({ ...msg, chatId: 1 });
  });
});

describe('ChatMemoryManager', () => {
  class DummyResetService implements ChatResetService {
    reset = vi.fn(async () => {});
  }
  class DummyInterestMessageStore implements InterestMessageStore {
    addMessage = vi.fn();
    getMessages = vi.fn(() => []);
    getCount = vi.fn(() => 0);
    getLastMessages = vi.fn(() => []);
    clearMessages = vi.fn();
  }
  class DummyChatConfigService implements ChatConfigService {
    constructor(private historyLimit: number) {}
    getConfig = vi.fn(
      async (chatId: number): Promise<ChatConfigEntity> => ({
        chatId,
        historyLimit: this.historyLimit,
        interestInterval: 0,
      })
    );
    setHistoryLimit = vi.fn(async () => {});
    setInterestInterval = vi.fn(async () => {});
  }

  it('creates ChatMemory with limit from ChatConfigService', async () => {
    const summarizer = new FakeHistorySummarizer();
    const config = new DummyChatConfigService(2);
    const manager = new ChatMemoryManager(
      new FakeMessageService(),
      summarizer,
      new DummyResetService(),
      new DummyInterestMessageStore(),
      config,
      createLoggerFactory()
    );
    const mem = await manager.get(5);
    await mem.addMessage({ chatId: 5, role: 'user', content: 'hi' });
    expect(summarizer.summarize).toHaveBeenCalledWith(
      5,
      [{ chatId: 5, role: 'user', content: 'hi' }],
      2
    );
    expect(config.getConfig).toHaveBeenCalledWith(5);
  });

  it('resets memory using ChatResetService', async () => {
    const reset = new DummyResetService();
    const local = new DummyInterestMessageStore();
    const manager = new ChatMemoryManager(
      new FakeMessageService(),
      new FakeHistorySummarizer(),
      reset,
      local,
      new DummyChatConfigService(2),
      createLoggerFactory()
    );
    await manager.reset(7);
    expect(reset.reset).toHaveBeenCalledWith(7);
    expect(local.clearMessages).toHaveBeenCalledWith(7);
  });
});

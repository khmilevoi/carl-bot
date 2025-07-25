import { AIService, ChatMessage } from './AIService';
import logger from './logger';
import { MemoryStorage } from './storage/MemoryStorage.interface';

export class ChatMemory {
  constructor(
    private gpt: AIService,
    private store: MemoryStorage,
    private chatId: number,
    private limit = 10
  ) {}

  public async addMessage(
    role: 'user' | 'assistant',
    content: string,
    username?: string
  ) {
    const history = await this.store.getMessages(this.chatId);
    logger.debug({ chatId: this.chatId, role }, 'Adding message');

    if (history.length > this.limit) {
      logger.debug({ chatId: this.chatId }, 'Summarizing chat history');
      const summary = await this.store.getSummary(this.chatId);
      const newSummary = await this.gpt.summarize(history, summary);
      await this.store.setSummary(this.chatId, newSummary);
      await this.store.clearMessages(this.chatId);
    }

    await this.store.addMessage(this.chatId, role, content, username);
  }

  public getHistory(): Promise<ChatMessage[]> {
    return this.store.getMessages(this.chatId);
  }

  public getSummary(): Promise<string> {
    return this.store.getSummary(this.chatId);
  }
}

export class ChatMemoryManager {
  constructor(
    private gpt: AIService,
    private store: MemoryStorage,
    private limit = 10
  ) {}

  public get(chatId: number): ChatMemory {
    logger.debug({ chatId }, 'Creating chat memory');
    return new ChatMemory(this.gpt, this.store, chatId, this.limit);
  }

  public async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat memory');
    await this.store.reset(chatId);
  }
}

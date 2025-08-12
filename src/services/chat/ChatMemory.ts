import { inject, injectable } from 'inversify';

import { AI_SERVICE_ID, AIService, ChatMessage } from '../ai/AIService';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import logger from '../logging/logger';
import {
  MEMORY_STORAGE_ID,
  MemoryStorage,
} from '../storage/MemoryStorage.interface';

@injectable()
export class ChatMemory {
  constructor(
    private gpt: AIService,
    private store: MemoryStorage,
    private chatId: number,
    private limit: number
  ) {}

  public async addMessage(
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
    const history = await this.store.getMessages(this.chatId);
    logger.debug({ chatId: this.chatId, role }, 'Adding message');

    if (history.length > this.limit) {
      logger.debug({ chatId: this.chatId }, 'Summarizing chat history');
      const summary = await this.store.getSummary(this.chatId);
      const newSummary = await this.gpt.summarize(history, summary);
      await this.store.setSummary(this.chatId, newSummary);
      await this.store.clearMessages(this.chatId);
    }

    await this.store.addMessage(
      this.chatId,
      role,
      content,
      username,
      fullName,
      replyText,
      replyUsername,
      quoteText,
      userId,
      messageId,
      firstName,
      lastName,
      chatTitle
    );
  }

  public getHistory(): Promise<ChatMessage[]> {
    return this.store.getMessages(this.chatId);
  }

  public getSummary(): Promise<string> {
    return this.store.getSummary(this.chatId);
  }
}

@injectable()
export class ChatMemoryManager {
  private limit: number;

  constructor(
    @inject(AI_SERVICE_ID) private gpt: AIService,
    @inject(MEMORY_STORAGE_ID) private store: MemoryStorage,
    @inject(ENV_SERVICE_ID) envService: EnvService
  ) {
    this.limit = envService.env.CHAT_HISTORY_LIMIT;
  }

  public get(chatId: number): ChatMemory {
    logger.debug({ chatId }, 'Creating chat memory');
    return new ChatMemory(this.gpt, this.store, chatId, this.limit);
  }

  public async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat memory');
    await this.store.reset(chatId);
  }
}

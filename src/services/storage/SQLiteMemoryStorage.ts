import { inject, injectable } from 'inversify';

import {
  CHAT_REPOSITORY_ID,
  type ChatRepository,
} from '../../repositories/interfaces/ChatRepository';
import {
  MESSAGE_REPOSITORY_ID,
  type MessageRepository,
} from '../../repositories/interfaces/MessageRepository';
import {
  SUMMARY_REPOSITORY_ID,
  type SummaryRepository,
} from '../../repositories/interfaces/SummaryRepository';
import {
  USER_REPOSITORY_ID,
  type UserRepository,
} from '../../repositories/interfaces/UserRepository';
import { ChatMessage } from '../ai/AIService';
import logger from '../logging/logger';
import { MemoryStorage } from './MemoryStorage.interface';

@injectable()
export class SQLiteMemoryStorage implements MemoryStorage {
  constructor(
    @inject(CHAT_REPOSITORY_ID) private chatRepo: ChatRepository,
    @inject(USER_REPOSITORY_ID) private userRepo: UserRepository,
    @inject(MESSAGE_REPOSITORY_ID) private messageRepo: MessageRepository,
    @inject(SUMMARY_REPOSITORY_ID) private summaryRepo: SummaryRepository
  ) {}

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
    logger.debug({ chatId, role }, 'Inserting message into database');
    const storedUserId = userId ?? 0;
    await this.chatRepo.upsert({ chatId, title: chatTitle ?? null });
    await this.userRepo.upsert({
      id: storedUserId,
      username: username ?? null,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
    });
    await this.messageRepo.insert({
      chatId,
      messageId: messageId ?? null,
      role,
      content,
      userId: storedUserId,
      replyText: replyText ?? null,
      replyUsername: replyUsername ?? null,
      quoteText: quoteText ?? null,
    });
  }

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    logger.debug({ chatId }, 'Fetching messages from database');
    return this.messageRepo.findByChatId(chatId);
  }

  async clearMessages(chatId: number) {
    logger.debug({ chatId }, 'Clearing messages table');
    await this.messageRepo.clearByChatId(chatId);
  }

  async getSummary(chatId: number) {
    logger.debug({ chatId }, 'Fetching summary');
    return this.summaryRepo.findById(chatId);
  }

  async setSummary(chatId: number, summary: string) {
    logger.debug({ chatId }, 'Storing summary');
    await this.summaryRepo.upsert(chatId, summary);
  }

  async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat data');
    await this.messageRepo.clearByChatId(chatId);
    await this.summaryRepo.clearByChatId(chatId);
  }
}

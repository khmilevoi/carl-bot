import { inject, injectable } from 'inversify';

import { ChatMessage } from '@/services/ai/AIService';
import logger from '@/services/logging/logger';
import { Message } from '@/services/storage/entities/Message';
import { Summary } from '@/services/storage/entities/Summary';
import { MemoryStorage } from '@/services/storage/MemoryStorage.interface';
import {
  MESSAGE_REPOSITORY_ID,
  MessageRepository,
} from '@/services/storage/repositories/MessageRepository';
import {
  SUMMARY_REPOSITORY_ID,
  SummaryRepository,
} from '@/services/storage/repositories/SummaryRepository';

@injectable()
export class TypeORMMemoryStorage implements MemoryStorage {
  constructor(
    @inject(MESSAGE_REPOSITORY_ID) private messages: MessageRepository,
    @inject(SUMMARY_REPOSITORY_ID) private summaries: SummaryRepository
  ) {}

  async addMessage(
    chatId: number,
    role: 'user' | 'assistant',
    content: string,
    username?: string,
    fullName?: string,
    replyText?: string,
    replyUsername?: string,
    quoteText?: string
  ) {
    logger.debug({ chatId, role }, 'Saving message via TypeORM');
    const message = new Message();
    Object.assign(message, {
      chatId,
      role,
      content,
      username,
      fullName,
      replyText,
      replyUsername,
      quoteText,
    });
    await this.messages.save(message);
  }

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    logger.debug({ chatId }, 'Loading messages via TypeORM');
    const rows = await this.messages.findByChatId(chatId);
    return rows.map((r) => {
      const entry: ChatMessage = { role: r.role, content: r.content };
      if (r.username) entry.username = r.username;
      if (r.fullName) entry.fullName = r.fullName;
      if (r.replyText) entry.replyText = r.replyText;
      if (r.replyUsername) entry.replyUsername = r.replyUsername;
      if (r.quoteText) entry.quoteText = r.quoteText;
      return entry;
    });
  }

  async clearMessages(chatId: number) {
    logger.debug({ chatId }, 'Clearing messages via TypeORM');
    await this.messages.deleteByChatId(chatId);
  }

  async getSummary(chatId: number) {
    logger.debug({ chatId }, 'Loading summary via TypeORM');
    const summary = await this.summaries.findByChatId(chatId);
    return summary?.summary ?? '';
  }

  async setSummary(chatId: number, summary: string) {
    logger.debug({ chatId }, 'Saving summary via TypeORM');
    await this.summaries.save({ chatId, summary } as Summary);
  }

  async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat via TypeORM');
    await this.clearMessages(chatId);
    await this.setSummary(chatId, '');
  }
}

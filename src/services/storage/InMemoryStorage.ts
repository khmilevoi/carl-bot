import logger from '../logging/logger';
import { MemoryStorage } from './MemoryStorage.interface';

export class InMemoryStorage implements MemoryStorage {
  private messages = new Map<
    number,
    {
      role: 'user' | 'assistant';
      content: string;
      username?: string;
      fullName?: string;
      replyText?: string;
      replyUsername?: string;
      quoteText?: string;
    }[]
  >();
  private summaries = new Map<number, string>();

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
    logger.debug({ chatId, role }, 'Storing message in memory');
    const list = this.messages.get(chatId) ?? [];
    const entry: {
      role: 'user' | 'assistant';
      content: string;
      username?: string;
      fullName?: string;
      replyText?: string;
      replyUsername?: string;
      quoteText?: string;
    } = { role, content };
    if (username) entry.username = username;
    if (fullName) entry.fullName = fullName;
    if (replyText) entry.replyText = replyText;
    if (replyUsername) entry.replyUsername = replyUsername;
    if (quoteText) entry.quoteText = quoteText;
    list.push(entry);
    this.messages.set(chatId, list);
  }

  async getMessages(chatId: number) {
    return this.messages.get(chatId) ?? [];
  }

  async clearMessages(chatId: number) {
    logger.debug({ chatId }, 'Clearing stored messages');
    this.messages.set(chatId, []);
  }

  async getSummary(chatId: number) {
    return this.summaries.get(chatId) ?? '';
  }

  async setSummary(chatId: number, summary: string) {
    logger.debug({ chatId }, 'Setting summary');
    this.summaries.set(chatId, summary);
  }

  async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting in-memory storage');
    this.messages.delete(chatId);
    this.summaries.delete(chatId);
  }
}

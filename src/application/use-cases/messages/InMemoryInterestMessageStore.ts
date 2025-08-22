import { inject, injectable } from 'inversify';

import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import { type InterestMessageStore } from '@/application/interfaces/messages/InterestMessageStore';
import type { ChatMessage } from '@/domain/messages/ChatMessage';
import type { StoredMessage } from '@/domain/messages/StoredMessage';

@injectable()
export class InMemoryInterestMessageStore implements InterestMessageStore {
  private readonly logger: Logger;
  private readonly messages = new Map<number, StoredMessage[]>();

  constructor(@inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('InterestMessageStore');
  }

  addMessage(msg: StoredMessage): void {
    const chatMessages = this.messages.get(msg.chatId) ?? [];
    const prevCount = chatMessages.length;
    chatMessages.push(msg);
    this.messages.set(msg.chatId, chatMessages);
    const newCount = chatMessages.length;
    this.logger.debug(
      { chatId: msg.chatId, prevCount, newCount },
      'Added message'
    );
  }

  getMessages(chatId: number): ChatMessage[] {
    return this.messages.get(chatId) ?? [];
  }

  getCount(chatId: number): number {
    return this.getMessages(chatId).length;
  }

  getLastMessages(chatId: number, limit: number): ChatMessage[] {
    const messages = this.getMessages(chatId);
    return messages.slice(-limit);
  }

  clearMessages(chatId: number): void {
    const prevCount = this.getCount(chatId);
    this.messages.delete(chatId);
    this.logger.debug({ chatId, prevCount, newCount: 0 }, 'Cleared messages');
  }
}

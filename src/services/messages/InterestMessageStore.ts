import { inject, injectable, type ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '../ai/AIService.interface';
import type Logger from '../logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../logging/LoggerFactory';
import type { StoredMessage } from './StoredMessage.interface';

export interface InterestMessageStore {
  addMessage(msg: StoredMessage): void;
  getMessages(chatId: number): ChatMessage[];
  getCount(chatId: number): number;
  getLastMessages(chatId: number, limit: number): ChatMessage[];
  clearMessages(chatId: number): void;
}

export const INTEREST_MESSAGE_STORE_ID = Symbol.for(
  'InterestMessageStore'
) as ServiceIdentifier<InterestMessageStore>;

@injectable()
export class InterestMessageStoreImpl implements InterestMessageStore {
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

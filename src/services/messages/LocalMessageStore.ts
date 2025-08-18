/* eslint-disable import/no-unused-modules */
import type { ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '../ai/AIService.interface';
import type { StoredMessage } from './StoredMessage.interface';

export interface LocalMessageStore {
  addMessage(msg: StoredMessage): void;
  getMessages(chatId: number): ChatMessage[];
  getCount(chatId: number): number;
  getLastMessages(chatId: number, limit: number): ChatMessage[];
  clearMessages(chatId: number): void;
}

export const LOCAL_MESSAGE_STORE_ID = Symbol.for(
  'LocalMessageStore'
) as ServiceIdentifier<LocalMessageStore>;

export class LocalMessageStoreImpl implements LocalMessageStore {
  private readonly messages = new Map<number, StoredMessage[]>();

  addMessage(msg: StoredMessage): void {
    const chatMessages = this.messages.get(msg.chatId) ?? [];
    chatMessages.push(msg);
    this.messages.set(msg.chatId, chatMessages);
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
    this.messages.delete(chatId);
  }
}

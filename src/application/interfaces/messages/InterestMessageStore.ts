import type { ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '@/domain/messages/ChatMessage';
import type { StoredMessage } from '@/domain/messages/StoredMessage';

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

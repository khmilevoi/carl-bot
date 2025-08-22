import type { ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '@/domain/messages/ChatMessage.interface';
import type { StoredMessage } from '@/domain/messages/StoredMessage.interface';

export interface MessageService {
  addMessage(message: StoredMessage): Promise<void>;
  getMessages(chatId: number): Promise<ChatMessage[]>;
  getCount(chatId: number): Promise<number>;
  getLastMessages(chatId: number, limit: number): Promise<ChatMessage[]>;
  clearMessages(chatId: number): Promise<void>;
}

export const MESSAGE_SERVICE_ID = Symbol.for(
  'MessageService'
) as ServiceIdentifier<MessageService>;

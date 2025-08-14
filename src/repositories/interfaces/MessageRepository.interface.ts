import type { ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '../../services/ai/AIService.interface';
import type { StoredMessage } from '../../services/messages/StoredMessage.interface';

export interface MessageRepository {
  insert(message: StoredMessage): Promise<void>;
  findByChatId(chatId: number): Promise<ChatMessage[]>;
  countByChatId(chatId: number): Promise<number>;
  findLastByChatId(chatId: number, limit: number): Promise<ChatMessage[]>;
  clearByChatId(chatId: number): Promise<void>;
}

export const MESSAGE_REPOSITORY_ID = Symbol.for(
  'MessageRepository'
) as ServiceIdentifier<MessageRepository>;

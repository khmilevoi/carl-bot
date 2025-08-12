import type { ServiceIdentifier } from 'inversify';

import { ChatMessage } from '../ai/AIService';
import { StoredMessage } from './StoredMessage';

export interface MessageService {
  addMessage(message: StoredMessage): Promise<void>;
  getMessages(chatId: number): Promise<ChatMessage[]>;
  clearMessages(chatId: number): Promise<void>;
}

export const MESSAGE_SERVICE_ID = Symbol.for(
  'MessageService'
) as ServiceIdentifier<MessageService>;

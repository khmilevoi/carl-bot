import type { ServiceIdentifier } from 'inversify';

import { ChatMessage } from '../ai/AIService';

export interface MessageService {
  addMessage(
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
  ): Promise<void>;
  getMessages(chatId: number): Promise<ChatMessage[]>;
  clearMessages(chatId: number): Promise<void>;
}

export const MESSAGE_SERVICE_ID = Symbol.for(
  'MessageService'
) as ServiceIdentifier<MessageService>;

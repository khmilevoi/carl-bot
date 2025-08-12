import type { ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '../../services/ai/AIService';

export interface MessageEntity {
  chatId: number;
  messageId?: number | null;
  role: 'user' | 'assistant';
  content: string;
  userId: number;
  replyText?: string | null;
  replyUsername?: string | null;
  quoteText?: string | null;
}

export interface MessageRepository {
  insert(message: MessageEntity): Promise<void>;
  findByChatId(chatId: number): Promise<ChatMessage[]>;
  clearByChatId(chatId: number): Promise<void>;
}

export const MESSAGE_REPOSITORY_ID = Symbol.for(
  'MessageRepository'
) as ServiceIdentifier<MessageRepository>;

export default MessageRepository;

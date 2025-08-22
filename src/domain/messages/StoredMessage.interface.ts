import type { ChatMessage } from './ChatMessage.interface';

export interface StoredMessage extends ChatMessage {
  chatId: number;
  messageId?: number;
  firstName?: string;
  lastName?: string;
  chatTitle?: string;
}

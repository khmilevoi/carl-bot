import type { ChatMessage } from './ChatMessage';

export interface StoredMessage extends ChatMessage {
  chatId: number;
  messageId?: number;
  firstName?: string;
  lastName?: string;
  chatTitle?: string;
}

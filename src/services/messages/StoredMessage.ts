import { ChatMessage } from '../ai/AIService';

export interface StoredMessage extends ChatMessage {
  chatId: number;
  messageId?: number;
  firstName?: string;
  lastName?: string;
  chatTitle?: string;
}

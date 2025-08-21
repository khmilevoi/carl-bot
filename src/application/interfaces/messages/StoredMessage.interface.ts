import type { ChatMessage } from '../ai/AIService.interface';

export interface StoredMessage extends ChatMessage {
  chatId: number;
  messageId?: number;
  firstName?: string;
  lastName?: string;
  chatTitle?: string;
}

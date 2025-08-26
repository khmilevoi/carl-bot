export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  username?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  replyText?: string;
  replyUsername?: string;
  quoteText?: string;
  userId?: number;
  messageId?: number;
  chatId?: number;
  attitude?: string | null;
}

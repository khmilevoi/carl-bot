export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  username?: string;
  fullName?: string;
  replyText?: string;
  replyUsername?: string;
  quoteText?: string;
  userId?: number;
  messageId?: number;
  chatId?: number;
}

export interface AIService {
  ask(history: ChatMessage[], summary?: string): Promise<string>;
  summarize(history: ChatMessage[], prev?: string): Promise<string>;
  checkInterest(
    history: ChatMessage[],
    summary: string
  ): Promise<{ messageId: string; why: string } | null>;
}

import type { ServiceIdentifier } from 'inversify';

export const AI_SERVICE_ID = Symbol.for(
  'AIService'
) as ServiceIdentifier<AIService>;

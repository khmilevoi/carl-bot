export interface MemoryStorage {
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
  getSummary(chatId: number): Promise<string>;
  setSummary(chatId: number, summary: string): Promise<void>;
  reset(chatId: number): Promise<void>;
}

import type { ServiceIdentifier } from 'inversify';

import { ChatMessage } from '../ai/AIService';

export const MEMORY_STORAGE_ID = Symbol.for(
  'MemoryStorage'
) as ServiceIdentifier<MemoryStorage>;

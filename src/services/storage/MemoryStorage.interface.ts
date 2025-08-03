export interface MemoryStorage {
  addMessage(
    chatId: number,
    role: 'user' | 'assistant',
    content: string,
    username?: string,
    replyText?: string,
    replyUsername?: string
  ): Promise<void>;
  getMessages(chatId: number): Promise<
    {
      role: 'user' | 'assistant';
      content: string;
      username?: string;
      replyText?: string;
      replyUsername?: string;
    }[]
  >;
  clearMessages(chatId: number): Promise<void>;
  getSummary(chatId: number): Promise<string>;
  setSummary(chatId: number, summary: string): Promise<void>;
  reset(chatId: number): Promise<void>;
}

import type { ServiceIdentifier } from 'inversify';

export const MEMORY_STORAGE_ID = Symbol.for(
  'MemoryStorage'
) as ServiceIdentifier<MemoryStorage>;

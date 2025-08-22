import type { ServiceIdentifier } from 'inversify';

import type { ChatMemory } from './ChatMemory';

export interface ChatMemoryManager {
  get(chatId: number): Promise<ChatMemory>;
  reset(chatId: number): Promise<void>;
}

export const CHAT_MEMORY_MANAGER_ID = Symbol.for(
  'ChatMemoryManager'
) as ServiceIdentifier<ChatMemoryManager>;

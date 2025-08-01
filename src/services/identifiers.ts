import type { ServiceIdentifier } from 'inversify';

import type { TelegramBot } from '../bot/TelegramBot';
import type { AIService } from './ai/AIService';
import type { ChatFilter } from './chat/ChatFilter';
import type { ChatMemoryManager } from './chat/ChatMemory';
import type { MemoryStorage } from './storage/MemoryStorage.interface';

export const SERVICE_ID = {
  TelegramBot: Symbol.for('TelegramBot') as ServiceIdentifier<TelegramBot>,
  AIService: Symbol.for('AIService') as ServiceIdentifier<AIService>,
  ChatMemoryManager: Symbol.for(
    'ChatMemoryManager'
  ) as ServiceIdentifier<ChatMemoryManager>,
  ChatFilter: Symbol.for('ChatFilter') as ServiceIdentifier<ChatFilter>,
  MemoryStorage: Symbol.for(
    'MemoryStorage'
  ) as ServiceIdentifier<MemoryStorage>,
} as const;

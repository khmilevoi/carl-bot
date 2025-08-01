import 'reflect-metadata';

import { Container } from 'inversify';

import { TelegramBot } from './bot/TelegramBot';
import { AIService } from './services/ai/AIService';
import { ChatGPTService } from './services/ai/ChatGPTService';
import {
  ChatFilter,
  JSONWhiteListChatFilter,
} from './services/chat/ChatFilter';
import { ChatMemoryManager } from './services/chat/ChatMemory';
import { SERVICE_ID } from './services/identifiers';
import { MemoryStorage } from './services/storage/MemoryStorage.interface';
import { SQLiteMemoryStorage } from './services/storage/SQLiteMemoryStorage';
import { parseDatabaseUrl } from './utils/database';

export const container = new Container();

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
const dbFileName = parseDatabaseUrl(process.env.DATABASE_URL);

if (!token || !apiKey) {
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

container
  .bind(SERVICE_ID.AIService)
  .toDynamicValue(() => new ChatGPTService(apiKey, 'o3', 'gpt-4o-mini'))
  .inSingletonScope();

container
  .bind(SERVICE_ID.MemoryStorage)
  .toDynamicValue(() => new SQLiteMemoryStorage(dbFileName))
  .inSingletonScope();

container
  .bind(SERVICE_ID.ChatMemoryManager)
  .toDynamicValue(() => {
    const ai = container.get<AIService>(SERVICE_ID.AIService);
    const storage = container.get<MemoryStorage>(SERVICE_ID.MemoryStorage);
    return new ChatMemoryManager(ai, storage, 50);
  })
  .inSingletonScope();

container
  .bind(SERVICE_ID.ChatFilter)
  .toDynamicValue(() => new JSONWhiteListChatFilter('white_list.json'))
  .inSingletonScope();

container
  .bind(SERVICE_ID.TelegramBot)
  .toDynamicValue(() => {
    const ai = container.get<AIService>(SERVICE_ID.AIService);
    const memories = container.get<ChatMemoryManager>(
      SERVICE_ID.ChatMemoryManager
    );
    const filter = container.get<ChatFilter>(SERVICE_ID.ChatFilter);
    return new TelegramBot(token, ai, memories, filter);
  })
  .inSingletonScope();

export default container;

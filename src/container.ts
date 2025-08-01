import 'reflect-metadata';

import { Container } from 'inversify';

import { TelegramBot } from './bot/TelegramBot';
import { JSONWhiteListChatFilter } from './services/ChatFilter';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';
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
  .bind(ChatGPTService)
  .toDynamicValue(() => new ChatGPTService(apiKey, 'o3', 'gpt-4o-mini'))
  .inSingletonScope();

container
  .bind(SQLiteMemoryStorage)
  .toDynamicValue(() => new SQLiteMemoryStorage(dbFileName))
  .inSingletonScope();

container
  .bind(ChatMemoryManager)
  .toDynamicValue(() => {
    const ai = container.get(ChatGPTService);
    const storage = container.get(SQLiteMemoryStorage);
    return new ChatMemoryManager(ai, storage, 50);
  })
  .inSingletonScope();

container
  .bind(JSONWhiteListChatFilter)
  .toDynamicValue(() => new JSONWhiteListChatFilter('white_list.json'))
  .inSingletonScope();

container
  .bind(TelegramBot)
  .toDynamicValue(() => {
    const ai = container.get(ChatGPTService);
    const memories = container.get(ChatMemoryManager);
    const filter = container.get(JSONWhiteListChatFilter);
    return new TelegramBot(token, ai, memories, filter);
  })
  .inSingletonScope();

export default container;

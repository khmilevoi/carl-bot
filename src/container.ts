import 'reflect-metadata';

import { Container } from 'inversify';

import { TelegramBot } from './bot/TelegramBot';
import { JSONWhiteListChatFilter } from './services/ChatFilter';
import { ChatGPTService } from './services/ChatGPTService';
import { ChatMemoryManager } from './services/ChatMemory';
import { SQLiteMemoryStorage } from './services/storage/SQLiteMemoryStorage';

export const container = new Container();

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
const dbFileName = process.env.DB_FILE_NAME;

if (!token || !apiKey) {
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

if (!dbFileName) {
  throw new Error('DB_FILE_NAME is required');
}

container
  .bind(ChatGPTService)
  .toDynamicValue(() => new ChatGPTService(apiKey, 'o3', 'gpt-4o-mini'))
  .inSingletonScope();
container.bind(SQLiteMemoryStorage).toSelf().inSingletonScope();
container
  .bind(ChatMemoryManager)
  .toDynamicValue(
    (ctx) =>
      new ChatMemoryManager(
        ctx.container.get(ChatGPTService),
        ctx.container.get(SQLiteMemoryStorage),
        5
      )
  )
  .inSingletonScope();
container
  .bind(JSONWhiteListChatFilter)
  .toDynamicValue(() => new JSONWhiteListChatFilter('white_list.json'))
  .inSingletonScope();
container
  .bind(TelegramBot)
  .toDynamicValue(
    (ctx) =>
      new TelegramBot(
        token,
        ctx.container.get(ChatGPTService),
        ctx.container.get(ChatMemoryManager),
        ctx.container.get(JSONWhiteListChatFilter)
      )
  )
  .inSingletonScope();

export default container;

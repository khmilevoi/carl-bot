import 'reflect-metadata';

import { Container } from 'inversify';

import { TelegramBot } from './bot/TelegramBot';
import { ADMIN_SERVICE_ID, AdminService } from './services/admin/AdminService';
import { SQLiteAdminService } from './services/admin/SQLiteAdminService';
import { AI_SERVICE_ID, AIService } from './services/ai/AIService';
import { ChatGPTService } from './services/ai/ChatGPTService';
import {
  CHAT_FILTER_ID,
  ChatFilter,
  JSONWhiteListChatFilter,
} from './services/chat/ChatFilter';
import { ChatMemoryManager } from './services/chat/ChatMemory';
import { ENV_SERVICE_ID, envService } from './services/env/EnvService';
import { FilePromptService } from './services/prompts/FilePromptService';
import {
  PROMPT_SERVICE_ID,
  PromptService,
} from './services/prompts/PromptService';
import {
  MEMORY_STORAGE_ID,
  MemoryStorage,
} from './services/storage/MemoryStorage.interface';
import { SQLiteMemoryStorage } from './services/storage/SQLiteMemoryStorage';
import { parseDatabaseUrl } from './utils/database';

export const container = new Container();

container.bind(ENV_SERVICE_ID).toConstantValue(envService);

const { BOT_TOKEN, OPENAI_API_KEY, DATABASE_URL, CHAT_HISTORY_LIMIT } =
  envService.env;
const dbFileName = parseDatabaseUrl(DATABASE_URL);
const historyLimit = CHAT_HISTORY_LIMIT;

container
  .bind(PROMPT_SERVICE_ID)
  .toDynamicValue(() => new FilePromptService())
  .inSingletonScope();

container
  .bind(AI_SERVICE_ID)
  .toDynamicValue(() => {
    const prompts = container.get<PromptService>(PROMPT_SERVICE_ID);
    return new ChatGPTService(OPENAI_API_KEY, 'o3', 'o3-mini', prompts);
  })
  .inSingletonScope();

container
  .bind(MEMORY_STORAGE_ID)
  .toDynamicValue(() => new SQLiteMemoryStorage(dbFileName))
  .inSingletonScope();

container
  .bind(ADMIN_SERVICE_ID)
  .toDynamicValue(() => new SQLiteAdminService(dbFileName))
  .inSingletonScope();

container
  .bind(ChatMemoryManager)
  .toDynamicValue(() => {
    const ai = container.get<AIService>(AI_SERVICE_ID);
    const storage = container.get<MemoryStorage>(MEMORY_STORAGE_ID);
    return new ChatMemoryManager(ai, storage, historyLimit);
  })
  .inSingletonScope();

container
  .bind(CHAT_FILTER_ID)
  .toDynamicValue(() => new JSONWhiteListChatFilter('white_list.json'))
  .inSingletonScope();

container
  .bind(TelegramBot)
  .toDynamicValue(() => {
    const ai = container.get<AIService>(AI_SERVICE_ID);
    const memories = container.get<ChatMemoryManager>(ChatMemoryManager);
    const filter = container.get<ChatFilter>(CHAT_FILTER_ID);
    const admin = container.get<AdminService>(ADMIN_SERVICE_ID);
    return new TelegramBot(BOT_TOKEN, ai, memories, filter, admin);
  })
  .inSingletonScope();

export default container;

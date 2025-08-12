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
import {
  DefaultEnvService,
  ENV_SERVICE_ID,
  EnvService,
  TestEnvService,
} from './services/env/EnvService';
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

const EnvServiceImpl =
  process.env.NODE_ENV === 'test' ? TestEnvService : DefaultEnvService;

container
  .bind<EnvService>(ENV_SERVICE_ID)
  .to(EnvServiceImpl)
  .inSingletonScope();

container
  .bind(PROMPT_SERVICE_ID)
  .toDynamicValue(() => new FilePromptService())
  .inSingletonScope();

container
  .bind(AI_SERVICE_ID)
  .toDynamicValue(() => {
    const envService = container.get<EnvService>(ENV_SERVICE_ID);
    const prompts = container.get<PromptService>(PROMPT_SERVICE_ID);
    const env = envService.env;
    return new ChatGPTService(
      env.OPENAI_API_KEY,
      'o3',
      'o3-mini',
      envService,
      prompts
    );
  })
  .inSingletonScope();

container
  .bind(MEMORY_STORAGE_ID)
  .toDynamicValue(() => {
    const env = container.get<EnvService>(ENV_SERVICE_ID).env;
    const dbFileName = parseDatabaseUrl(env.DATABASE_URL);
    return new SQLiteMemoryStorage(dbFileName);
  })
  .inSingletonScope();

container
  .bind(ADMIN_SERVICE_ID)
  .toDynamicValue(() => {
    const env = container.get<EnvService>(ENV_SERVICE_ID).env;
    const dbFileName = parseDatabaseUrl(env.DATABASE_URL);
    return new SQLiteAdminService(dbFileName);
  })
  .inSingletonScope();

container
  .bind(ChatMemoryManager)
  .toDynamicValue(() => {
    const ai = container.get<AIService>(AI_SERVICE_ID);
    const storage = container.get<MemoryStorage>(MEMORY_STORAGE_ID);
    const env = container.get<EnvService>(ENV_SERVICE_ID).env;
    return new ChatMemoryManager(ai, storage, env.CHAT_HISTORY_LIMIT);
  })
  .inSingletonScope();

container
  .bind(CHAT_FILTER_ID)
  .toDynamicValue(() => new JSONWhiteListChatFilter('white_list.json'))
  .inSingletonScope();

container.bind(TelegramBot).toSelf().inSingletonScope();

export default container;

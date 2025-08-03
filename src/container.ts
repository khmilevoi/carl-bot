import 'reflect-metadata';

import { Container } from 'inversify';
import { DataSource } from 'typeorm';

import { TelegramBot } from '@/bot/TelegramBot';
import { AI_SERVICE_ID, AIService } from '@/services/ai/AIService';
import { ChatGPTService } from '@/services/ai/ChatGPTService';
import {
  CHAT_FILTER_ID,
  ChatFilter,
  JSONWhiteListChatFilter,
} from '@/services/chat/ChatFilter';
import { ChatMemoryManager } from '@/services/chat/ChatMemory';
import { FilePromptService } from '@/services/prompts/FilePromptService';
import {
  PROMPT_SERVICE_ID,
  PromptService,
} from '@/services/prompts/PromptService';
import { DATA_SOURCE_ID, getDataSource } from '@/services/storage/dataSource';
import {
  MEMORY_STORAGE_ID,
  MemoryStorage,
} from '@/services/storage/MemoryStorage.interface';
import {
  AWAITING_EXPORT_REPOSITORY_ID,
  AwaitingExportRepository,
} from '@/services/storage/repositories/AwaitingExportRepository';
import {
  MESSAGE_REPOSITORY_ID,
  MessageRepository,
} from '@/services/storage/repositories/MessageRepository';
import {
  SUMMARY_REPOSITORY_ID,
  SummaryRepository,
} from '@/services/storage/repositories/SummaryRepository';
import { TypeORMAwaitingExportRepository } from '@/services/storage/repositories/TypeORMAwaitingExportRepository';
import { TypeORMMessageRepository } from '@/services/storage/repositories/TypeORMMessageRepository';
import { TypeORMSummaryRepository } from '@/services/storage/repositories/TypeORMSummaryRepository';
import { TypeORMMemoryStorage } from '@/services/storage/TypeORMMemoryStorage';
import { parseDatabaseUrl } from '@/utils/database';

export const container = new Container();

const token = process.env.BOT_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
const dbFileName = parseDatabaseUrl(process.env.DATABASE_URL);
const historyLimit = Number(process.env.CHAT_HISTORY_LIMIT ?? '50');

if (!token || !apiKey) {
  throw new Error('BOT_TOKEN and OPENAI_API_KEY are required');
}

container
  .bind(PROMPT_SERVICE_ID)
  .toDynamicValue(() => new FilePromptService())
  .inSingletonScope();

container
  .bind(AI_SERVICE_ID)
  .toDynamicValue(() => {
    const prompts = container.get<PromptService>(PROMPT_SERVICE_ID);
    return new ChatGPTService(apiKey, 'o3', 'o3-mini', prompts);
  })
  .inSingletonScope();

container
  .bind<Promise<DataSource>>(DATA_SOURCE_ID)
  .toDynamicValue(() => getDataSource(dbFileName))
  .inSingletonScope();

container
  .bind<MessageRepository>(MESSAGE_REPOSITORY_ID)
  .to(TypeORMMessageRepository)
  .inSingletonScope();

container
  .bind<SummaryRepository>(SUMMARY_REPOSITORY_ID)
  .to(TypeORMSummaryRepository)
  .inSingletonScope();

container
  .bind<AwaitingExportRepository>(AWAITING_EXPORT_REPOSITORY_ID)
  .to(TypeORMAwaitingExportRepository)
  .inSingletonScope();

container.bind(MEMORY_STORAGE_ID).to(TypeORMMemoryStorage).inSingletonScope();

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
    const awaitingRepo = container.get<AwaitingExportRepository>(
      AWAITING_EXPORT_REPOSITORY_ID
    );
    const db = container.get<Promise<DataSource>>(DATA_SOURCE_ID);
    return new TelegramBot(token, ai, memories, filter, awaitingRepo, db);
  })
  .inSingletonScope();

export default container;

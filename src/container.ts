import 'reflect-metadata';

import { Container } from 'inversify';

import { TelegramBot } from './bot/TelegramBot';
import {
  DB_PROVIDER_ID,
  SQLiteDbProviderImpl,
} from './repositories/DbProvider';
import { ACCESS_KEY_REPOSITORY_ID } from './repositories/interfaces/AccessKeyRepository';
import { CHAT_REPOSITORY_ID } from './repositories/interfaces/ChatRepository';
import { MESSAGE_REPOSITORY_ID } from './repositories/interfaces/MessageRepository';
import { SUMMARY_REPOSITORY_ID } from './repositories/interfaces/SummaryRepository';
import { USER_REPOSITORY_ID } from './repositories/interfaces/UserRepository';
import { SQLiteAccessKeyRepository } from './repositories/sqlite/SQLiteAccessKeyRepository';
import { SQLiteChatRepository } from './repositories/sqlite/SQLiteChatRepository';
import { SQLiteMessageRepository } from './repositories/sqlite/SQLiteMessageRepository';
import { SQLiteSummaryRepository } from './repositories/sqlite/SQLiteSummaryRepository';
import { SQLiteUserRepository } from './repositories/sqlite/SQLiteUserRepository';
import { ADMIN_SERVICE_ID } from './services/admin/AdminService';
import { SQLiteAdminService } from './services/admin/SQLiteAdminService';
import { AI_SERVICE_ID } from './services/ai/AIService';
import { ChatGPTService } from './services/ai/ChatGPTService';
import {
  CHAT_FILTER_ID,
  JSONWhiteListChatFilter,
} from './services/chat/ChatFilter';
import { ChatMemoryManager } from './services/chat/ChatMemory';
import {
  CHAT_RESET_SERVICE_ID,
  type ChatResetService,
} from './services/chat/ChatResetService';
import {
  CHAT_RESPONDER_ID,
  ChatResponder,
  DefaultChatResponder,
} from './services/chat/ChatResponder';
import { DefaultChatResetService } from './services/chat/DefaultChatResetService';
import {
  DefaultTriggerPipeline,
  TRIGGER_PIPELINE_ID,
  TriggerPipeline,
} from './services/chat/TriggerPipeline';
import {
  DefaultEnvService,
  ENV_SERVICE_ID,
  EnvService,
  TestEnvService,
} from './services/env/EnvService';
import {
  DefaultMessageContextExtractor,
  MESSAGE_CONTEXT_EXTRACTOR_ID,
  MessageContextExtractor,
} from './services/messages/MessageContextExtractor';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from './services/messages/MessageService';
import { RepositoryMessageService } from './services/messages/RepositoryMessageService';
import { FilePromptService } from './services/prompts/FilePromptService';
import { PROMPT_SERVICE_ID } from './services/prompts/PromptService';
import { RepositorySummaryService } from './services/summaries/RepositorySummaryService';
import {
  SUMMARY_SERVICE_ID,
  type SummaryService,
} from './services/summaries/SummaryService';

export const container = new Container();

const EnvServiceImpl =
  process.env.NODE_ENV === 'test' ? TestEnvService : DefaultEnvService;

container
  .bind<EnvService>(ENV_SERVICE_ID)
  .to(EnvServiceImpl)
  .inSingletonScope();

container.bind(PROMPT_SERVICE_ID).to(FilePromptService).inSingletonScope();

container.bind(AI_SERVICE_ID).to(ChatGPTService).inSingletonScope();

container
  .bind(MESSAGE_SERVICE_ID)
  .to(RepositoryMessageService)
  .inSingletonScope();
container
  .bind(SUMMARY_SERVICE_ID)
  .to(RepositorySummaryService)
  .inSingletonScope();
container
  .bind(CHAT_RESET_SERVICE_ID)
  .to(DefaultChatResetService)
  .inSingletonScope();

container.bind(ADMIN_SERVICE_ID).to(SQLiteAdminService).inSingletonScope();

container.bind(DB_PROVIDER_ID).to(SQLiteDbProviderImpl).inSingletonScope();
container.bind(CHAT_REPOSITORY_ID).to(SQLiteChatRepository).inSingletonScope();
container.bind(USER_REPOSITORY_ID).to(SQLiteUserRepository).inSingletonScope();
container
  .bind(MESSAGE_REPOSITORY_ID)
  .to(SQLiteMessageRepository)
  .inSingletonScope();
container
  .bind(SUMMARY_REPOSITORY_ID)
  .to(SQLiteSummaryRepository)
  .inSingletonScope();
container
  .bind(ACCESS_KEY_REPOSITORY_ID)
  .to(SQLiteAccessKeyRepository)
  .inSingletonScope();

container.bind(ChatMemoryManager).toSelf().inSingletonScope();

container
  .bind<MessageContextExtractor>(MESSAGE_CONTEXT_EXTRACTOR_ID)
  .to(DefaultMessageContextExtractor)
  .inSingletonScope();

container
  .bind<TriggerPipeline>(TRIGGER_PIPELINE_ID)
  .to(DefaultTriggerPipeline)
  .inSingletonScope();

container
  .bind<ChatResponder>(CHAT_RESPONDER_ID)
  .to(DefaultChatResponder)
  .inSingletonScope();

container.bind(CHAT_FILTER_ID).to(JSONWhiteListChatFilter).inSingletonScope();

container.bind(TelegramBot).toSelf().inSingletonScope();

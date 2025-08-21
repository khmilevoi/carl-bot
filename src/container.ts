import 'reflect-metadata';

import { Container } from 'inversify';

import { ADMIN_SERVICE_ID } from './application/interfaces/admin/AdminService.interface';
import { AI_SERVICE_ID } from './application/interfaces/ai/AIService.interface';
import { CHAT_APPROVAL_SERVICE_ID } from './application/interfaces/chat/ChatApprovalService.interface';
import {
  CHAT_CONFIG_SERVICE_ID,
  type ChatConfigService,
} from './application/interfaces/chat/ChatConfigService.interface';
import { CHAT_RESET_SERVICE_ID } from './application/interfaces/chat/ChatResetService.interface';
import {
  CHAT_RESPONDER_ID,
  type ChatResponder,
} from './application/interfaces/chat/ChatResponder.interface';
import { DIALOGUE_MANAGER_ID } from './application/interfaces/chat/DialogueManager.interface';
import { HISTORY_SUMMARIZER_ID } from './application/interfaces/chat/HistorySummarizer.interface';
import {
  TRIGGER_PIPELINE_ID,
  type TriggerPipeline,
} from './application/interfaces/chat/TriggerPipeline.interface';
import {
  ENV_SERVICE_ID,
  type EnvService,
} from './application/interfaces/env/EnvService.interface';
import { INTEREST_CHECKER_ID } from './application/interfaces/interest/InterestChecker.interface';
import { LOGGER_FACTORY_ID } from './application/interfaces/logging/LoggerFactory.interface';
import { INTEREST_MESSAGE_STORE_ID } from './application/interfaces/messages/InterestMessageStore.interface';
import {
  MESSAGE_CONTEXT_EXTRACTOR_ID,
  type MessageContextExtractor,
} from './application/interfaces/messages/MessageContextExtractor.interface';
import { MESSAGE_SERVICE_ID } from './application/interfaces/messages/MessageService.interface';
import { PROMPT_SERVICE_ID } from './application/interfaces/prompts/PromptService.interface';
import { SUMMARY_SERVICE_ID } from './application/interfaces/summaries/SummaryService.interface';
import { AdminServiceImpl } from './application/use-cases/admin/AdminServiceImpl';
import { ChatGPTService } from './application/use-cases/ai/ChatGPTService';
import { ChatMemoryManager } from './application/use-cases/chat/ChatMemory';
import { DefaultChatApprovalService } from './application/use-cases/chat/DefaultChatApprovalService';
import { DefaultChatResetService } from './application/use-cases/chat/DefaultChatResetService';
import { DefaultChatResponder } from './application/use-cases/chat/DefaultChatResponder';
import { DefaultDialogueManager } from './application/use-cases/chat/DefaultDialogueManager';
import { DefaultHistorySummarizer } from './application/use-cases/chat/DefaultHistorySummarizer';
import { DefaultTriggerPipeline } from './application/use-cases/chat/DefaultTriggerPipeline';
import { RepositoryChatConfigService } from './application/use-cases/chat/RepositoryChatConfigService';
import { DefaultEnvService } from './application/use-cases/env/DefaultEnvService';
import { TestEnvService } from './application/use-cases/env/TestEnvService';
import { DefaultInterestChecker } from './application/use-cases/interest/DefaultInterestChecker';
import { PinoLoggerFactory } from './application/use-cases/logging/PinoLoggerFactory';
import { DefaultMessageContextExtractor } from './application/use-cases/messages/DefaultMessageContextExtractor';
import { InMemoryInterestMessageStore } from './application/use-cases/messages/InMemoryInterestMessageStore';
import { RepositoryMessageService } from './application/use-cases/messages/RepositoryMessageService';
import { FilePromptService } from './application/use-cases/prompts/FilePromptService';
import { RepositorySummaryService } from './application/use-cases/summaries/RepositorySummaryService';
import { TelegramBot } from './bot/TelegramBot';
import { ACCESS_KEY_REPOSITORY_ID } from './domain/repositories/AccessKeyRepository.interface';
import { CHAT_ACCESS_REPOSITORY_ID } from './domain/repositories/ChatAccessRepository.interface';
import { CHAT_CONFIG_REPOSITORY_ID } from './domain/repositories/ChatConfigRepository.interface';
import { CHAT_REPOSITORY_ID } from './domain/repositories/ChatRepository.interface';
import { CHAT_USER_REPOSITORY_ID } from './domain/repositories/ChatUserRepository.interface';
import { MESSAGE_REPOSITORY_ID } from './domain/repositories/MessageRepository.interface';
import { SUMMARY_REPOSITORY_ID } from './domain/repositories/SummaryRepository.interface';
import { USER_REPOSITORY_ID } from './domain/repositories/UserRepository.interface';
import {
  DB_PROVIDER_ID,
  SQLiteDbProviderImpl,
} from './repositories/DbProvider';
import { SQLiteAccessKeyRepository } from './repositories/sqlite/SQLiteAccessKeyRepository';
import { SQLiteChatAccessRepository } from './repositories/sqlite/SQLiteChatAccessRepository';
import { SQLiteChatConfigRepository } from './repositories/sqlite/SQLiteChatConfigRepository';
import { SQLiteChatRepository } from './repositories/sqlite/SQLiteChatRepository';
import { SQLiteChatUserRepository } from './repositories/sqlite/SQLiteChatUserRepository';
import { SQLiteMessageRepository } from './repositories/sqlite/SQLiteMessageRepository';
import { SQLiteSummaryRepository } from './repositories/sqlite/SQLiteSummaryRepository';
import { SQLiteUserRepository } from './repositories/sqlite/SQLiteUserRepository';

export const container = new Container();

const EnvServiceImpl =
  process.env.NODE_ENV === 'test' ? TestEnvService : DefaultEnvService;

container
  .bind<EnvService>(ENV_SERVICE_ID)
  .to(EnvServiceImpl)
  .inSingletonScope();

container.bind(LOGGER_FACTORY_ID).to(PinoLoggerFactory).inSingletonScope();

container.bind(PROMPT_SERVICE_ID).to(FilePromptService).inSingletonScope();

container.bind(AI_SERVICE_ID).to(ChatGPTService).inSingletonScope();

container
  .bind(MESSAGE_SERVICE_ID)
  .to(RepositoryMessageService)
  .inSingletonScope();
container
  .bind(INTEREST_MESSAGE_STORE_ID)
  .to(InMemoryInterestMessageStore)
  .inSingletonScope();
container
  .bind(SUMMARY_SERVICE_ID)
  .to(RepositorySummaryService)
  .inSingletonScope();
container
  .bind(HISTORY_SUMMARIZER_ID)
  .to(DefaultHistorySummarizer)
  .inSingletonScope();
container
  .bind(CHAT_RESET_SERVICE_ID)
  .to(DefaultChatResetService)
  .inSingletonScope();
container
  .bind(CHAT_APPROVAL_SERVICE_ID)
  .to(DefaultChatApprovalService)
  .inSingletonScope();

container
  .bind<ChatConfigService>(CHAT_CONFIG_SERVICE_ID)
  .to(RepositoryChatConfigService)
  .inSingletonScope();

container
  .bind(INTEREST_CHECKER_ID)
  .to(DefaultInterestChecker)
  .inSingletonScope();

container.bind(ADMIN_SERVICE_ID).to(AdminServiceImpl).inSingletonScope();

container.bind(DB_PROVIDER_ID).to(SQLiteDbProviderImpl).inSingletonScope();
container.bind(CHAT_REPOSITORY_ID).to(SQLiteChatRepository).inSingletonScope();
container
  .bind(CHAT_USER_REPOSITORY_ID)
  .to(SQLiteChatUserRepository)
  .inSingletonScope();
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
container
  .bind(CHAT_ACCESS_REPOSITORY_ID)
  .to(SQLiteChatAccessRepository)
  .inSingletonScope();

container
  .bind(CHAT_CONFIG_REPOSITORY_ID)
  .to(SQLiteChatConfigRepository)
  .inSingletonScope();

container.bind(ChatMemoryManager).toSelf().inSingletonScope();

container
  .bind(DIALOGUE_MANAGER_ID)
  .to(DefaultDialogueManager)
  .inSingletonScope();

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

container.bind(TelegramBot).toSelf().inSingletonScope();

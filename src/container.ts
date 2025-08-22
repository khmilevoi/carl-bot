import 'reflect-metadata';

import { Container } from 'inversify';

import {
  ADMIN_SERVICE_ID,
  type AdminService,
} from './application/interfaces/admin/AdminService.interface';
import {
  AI_SERVICE_ID,
  type AIService,
} from './application/interfaces/ai/AIService.interface';
import {
  CHAT_APPROVAL_SERVICE_ID,
  type ChatApprovalService,
} from './application/interfaces/chat/ChatApprovalService.interface';
import {
  CHAT_CONFIG_SERVICE_ID,
  type ChatConfigService,
} from './application/interfaces/chat/ChatConfigService.interface';
import {
  CHAT_MEMORY_MANAGER_ID,
  type ChatMemoryManager as ChatMemoryManagerInterface,
} from './application/interfaces/chat/ChatMemoryManager.interface';
import {
  CHAT_RESET_SERVICE_ID,
  type ChatResetService,
} from './application/interfaces/chat/ChatResetService.interface';
import {
  CHAT_RESPONDER_ID,
  type ChatResponder,
} from './application/interfaces/chat/ChatResponder.interface';
import {
  DIALOGUE_MANAGER_ID,
  type DialogueManager,
} from './application/interfaces/chat/DialogueManager.interface';
import {
  HISTORY_SUMMARIZER_ID,
  type HistorySummarizer,
} from './application/interfaces/chat/HistorySummarizer.interface';
import {
  TRIGGER_PIPELINE_ID,
  type TriggerPipeline,
} from './application/interfaces/chat/TriggerPipeline.interface';
import {
  ENV_SERVICE_ID,
  type EnvService,
} from './application/interfaces/env/EnvService.interface';
import {
  INTEREST_CHECKER_ID,
  type InterestChecker,
} from './application/interfaces/interest/InterestChecker.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from './application/interfaces/logging/LoggerFactory.interface';
import {
  INTEREST_MESSAGE_STORE_ID,
  type InterestMessageStore,
} from './application/interfaces/messages/InterestMessageStore.interface';
import {
  MESSAGE_CONTEXT_EXTRACTOR_ID,
  type MessageContextExtractor,
} from './application/interfaces/messages/MessageContextExtractor.interface';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from './application/interfaces/messages/MessageService.interface';
import {
  PROMPT_SERVICE_ID,
  type PromptService,
} from './application/interfaces/prompts/PromptService.interface';
import {
  SUMMARY_SERVICE_ID,
  type SummaryService,
} from './application/interfaces/summaries/SummaryService.interface';
import { AdminServiceImpl } from './application/use-cases/admin/AdminServiceImpl';
import { ChatMemoryManager as ChatMemoryManagerImpl } from './application/use-cases/chat/ChatMemory';
import { DefaultChatApprovalService } from './application/use-cases/chat/DefaultChatApprovalService';
import { DefaultChatResetService } from './application/use-cases/chat/DefaultChatResetService';
import { DefaultChatResponder } from './application/use-cases/chat/DefaultChatResponder';
import { DefaultDialogueManager } from './application/use-cases/chat/DefaultDialogueManager';
import { DefaultHistorySummarizer } from './application/use-cases/chat/DefaultHistorySummarizer';
import { DefaultTriggerPipeline } from './application/use-cases/chat/DefaultTriggerPipeline';
import { RepositoryChatConfigService } from './application/use-cases/chat/RepositoryChatConfigService';
import { DefaultInterestChecker } from './application/use-cases/interest/DefaultInterestChecker';
import { DefaultMessageContextExtractor } from './application/use-cases/messages/DefaultMessageContextExtractor';
import { InMemoryInterestMessageStore } from './application/use-cases/messages/InMemoryInterestMessageStore';
import { RepositoryMessageService } from './application/use-cases/messages/RepositoryMessageService';
import { RepositorySummaryService } from './application/use-cases/summaries/RepositorySummaryService';
import {
  ACCESS_KEY_REPOSITORY_ID,
  type AccessKeyRepository,
} from './domain/repositories/AccessKeyRepository.interface';
import {
  CHAT_ACCESS_REPOSITORY_ID,
  type ChatAccessRepository,
} from './domain/repositories/ChatAccessRepository.interface';
import {
  CHAT_CONFIG_REPOSITORY_ID,
  type ChatConfigRepository,
} from './domain/repositories/ChatConfigRepository.interface';
import {
  CHAT_REPOSITORY_ID,
  type ChatRepository,
} from './domain/repositories/ChatRepository.interface';
import {
  CHAT_USER_REPOSITORY_ID,
  type ChatUserRepository,
} from './domain/repositories/ChatUserRepository.interface';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from './domain/repositories/DbProvider.interface';
import {
  MESSAGE_REPOSITORY_ID,
  type MessageRepository,
} from './domain/repositories/MessageRepository.interface';
import {
  SUMMARY_REPOSITORY_ID,
  type SummaryRepository,
} from './domain/repositories/SummaryRepository.interface';
import {
  USER_REPOSITORY_ID,
  type UserRepository,
} from './domain/repositories/UserRepository.interface';
import { type Trigger, TRIGGER_ID } from './domain/triggers/Trigger.interface';
import { DefaultEnvService } from './infrastructure/config/DefaultEnvService';
import { TestEnvService } from './infrastructure/config/TestEnvService';
import { ChatGPTService } from './infrastructure/external/ChatGPTService';
import { FilePromptService } from './infrastructure/external/FilePromptService';
import { PinoLoggerFactory } from './infrastructure/logging/PinoLoggerFactory';
import { SQLiteDbProviderImpl } from './infrastructure/persistence/sqlite/DbProvider';
import { SQLiteAccessKeyRepository } from './infrastructure/persistence/sqlite/SQLiteAccessKeyRepository';
import { SQLiteChatAccessRepository } from './infrastructure/persistence/sqlite/SQLiteChatAccessRepository';
import { SQLiteChatConfigRepository } from './infrastructure/persistence/sqlite/SQLiteChatConfigRepository';
import { SQLiteChatRepository } from './infrastructure/persistence/sqlite/SQLiteChatRepository';
import { SQLiteChatUserRepository } from './infrastructure/persistence/sqlite/SQLiteChatUserRepository';
import { SQLiteMessageRepository } from './infrastructure/persistence/sqlite/SQLiteMessageRepository';
import { SQLiteSummaryRepository } from './infrastructure/persistence/sqlite/SQLiteSummaryRepository';
import { SQLiteUserRepository } from './infrastructure/persistence/sqlite/SQLiteUserRepository';
import { TelegramBot } from './view/telegram/TelegramBot';
import { InterestTrigger } from './view/telegram/triggers/InterestTrigger';
import { MentionTrigger } from './view/telegram/triggers/MentionTrigger';
import { NameTrigger } from './view/telegram/triggers/NameTrigger';
import { ReplyTrigger } from './view/telegram/triggers/ReplyTrigger';

export const container = new Container();

const EnvServiceImpl =
  process.env.NODE_ENV === 'test' ? TestEnvService : DefaultEnvService;

container
  .bind<EnvService>(ENV_SERVICE_ID)
  .to(EnvServiceImpl)
  .inSingletonScope();

container
  .bind<LoggerFactory>(LOGGER_FACTORY_ID)
  .to(PinoLoggerFactory)
  .inSingletonScope();

container
  .bind<PromptService>(PROMPT_SERVICE_ID)
  .to(FilePromptService)
  .inSingletonScope();

container.bind<AIService>(AI_SERVICE_ID).to(ChatGPTService).inSingletonScope();

container
  .bind<MessageService>(MESSAGE_SERVICE_ID)
  .to(RepositoryMessageService)
  .inSingletonScope();
container
  .bind<InterestMessageStore>(INTEREST_MESSAGE_STORE_ID)
  .to(InMemoryInterestMessageStore)
  .inSingletonScope();
container
  .bind<SummaryService>(SUMMARY_SERVICE_ID)
  .to(RepositorySummaryService)
  .inSingletonScope();
container
  .bind<HistorySummarizer>(HISTORY_SUMMARIZER_ID)
  .to(DefaultHistorySummarizer)
  .inSingletonScope();
container
  .bind<ChatResetService>(CHAT_RESET_SERVICE_ID)
  .to(DefaultChatResetService)
  .inSingletonScope();
container
  .bind<ChatApprovalService>(CHAT_APPROVAL_SERVICE_ID)
  .to(DefaultChatApprovalService)
  .inSingletonScope();

container
  .bind<ChatConfigService>(CHAT_CONFIG_SERVICE_ID)
  .to(RepositoryChatConfigService)
  .inSingletonScope();

container
  .bind<InterestChecker>(INTEREST_CHECKER_ID)
  .to(DefaultInterestChecker)
  .inSingletonScope();

container
  .bind<AdminService>(ADMIN_SERVICE_ID)
  .to(AdminServiceImpl)
  .inSingletonScope();

container
  .bind<DbProvider>(DB_PROVIDER_ID)
  .to(SQLiteDbProviderImpl)
  .inSingletonScope();
container
  .bind<ChatRepository>(CHAT_REPOSITORY_ID)
  .to(SQLiteChatRepository)
  .inSingletonScope();
container
  .bind<ChatUserRepository>(CHAT_USER_REPOSITORY_ID)
  .to(SQLiteChatUserRepository)
  .inSingletonScope();
container
  .bind<UserRepository>(USER_REPOSITORY_ID)
  .to(SQLiteUserRepository)
  .inSingletonScope();
container
  .bind<MessageRepository>(MESSAGE_REPOSITORY_ID)
  .to(SQLiteMessageRepository)
  .inSingletonScope();
container
  .bind<SummaryRepository>(SUMMARY_REPOSITORY_ID)
  .to(SQLiteSummaryRepository)
  .inSingletonScope();
container
  .bind<AccessKeyRepository>(ACCESS_KEY_REPOSITORY_ID)
  .to(SQLiteAccessKeyRepository)
  .inSingletonScope();
container
  .bind<ChatAccessRepository>(CHAT_ACCESS_REPOSITORY_ID)
  .to(SQLiteChatAccessRepository)
  .inSingletonScope();

container
  .bind<ChatConfigRepository>(CHAT_CONFIG_REPOSITORY_ID)
  .to(SQLiteChatConfigRepository)
  .inSingletonScope();

container
  .bind<ChatMemoryManagerInterface>(CHAT_MEMORY_MANAGER_ID)
  .to(ChatMemoryManagerImpl)
  .inSingletonScope();

container
  .bind<DialogueManager>(DIALOGUE_MANAGER_ID)
  .to(DefaultDialogueManager)
  .inSingletonScope();

container
  .bind<MessageContextExtractor>(MESSAGE_CONTEXT_EXTRACTOR_ID)
  .to(DefaultMessageContextExtractor)
  .inSingletonScope();

container.bind<Trigger>(TRIGGER_ID).to(MentionTrigger).inSingletonScope();
container.bind<Trigger>(TRIGGER_ID).to(ReplyTrigger).inSingletonScope();
container.bind<Trigger>(TRIGGER_ID).to(NameTrigger).inSingletonScope();
container.bind<Trigger>(TRIGGER_ID).to(InterestTrigger).inSingletonScope();

container
  .bind<TriggerPipeline>(TRIGGER_PIPELINE_ID)
  .to(DefaultTriggerPipeline)
  .inSingletonScope();

container
  .bind<ChatResponder>(CHAT_RESPONDER_ID)
  .to(DefaultChatResponder)
  .inSingletonScope();

container.bind(TelegramBot).toSelf().inSingletonScope();

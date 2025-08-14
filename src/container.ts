import 'reflect-metadata';

import { Container } from 'inversify';

import { TelegramBot } from './bot/TelegramBot';
import {
  DB_PROVIDER_ID,
  SQLiteDbProviderImpl,
} from './repositories/DbProvider';
import { ACCESS_KEY_REPOSITORY_ID } from './repositories/interfaces/AccessKeyRepository.interface';
import { CHAT_ACCESS_REPOSITORY_ID } from './repositories/interfaces/ChatAccessRepository.interface';
import { CHAT_REPOSITORY_ID } from './repositories/interfaces/ChatRepository.interface';
import { CHAT_USER_REPOSITORY_ID } from './repositories/interfaces/ChatUserRepository.interface';
import { MESSAGE_REPOSITORY_ID } from './repositories/interfaces/MessageRepository.interface';
import { SUMMARY_REPOSITORY_ID } from './repositories/interfaces/SummaryRepository.interface';
import { USER_REPOSITORY_ID } from './repositories/interfaces/UserRepository.interface';
import { SQLiteAccessKeyRepository } from './repositories/sqlite/SQLiteAccessKeyRepository';
import { SQLiteChatAccessRepository } from './repositories/sqlite/SQLiteChatAccessRepository';
import { SQLiteChatRepository } from './repositories/sqlite/SQLiteChatRepository';
import { SQLiteChatUserRepository } from './repositories/sqlite/SQLiteChatUserRepository';
import { SQLiteMessageRepository } from './repositories/sqlite/SQLiteMessageRepository';
import { SQLiteSummaryRepository } from './repositories/sqlite/SQLiteSummaryRepository';
import { SQLiteUserRepository } from './repositories/sqlite/SQLiteUserRepository';
import { ADMIN_SERVICE_ID } from './services/admin/AdminService.interface';
import { AdminServiceImpl } from './services/admin/AdminServiceImpl';
import { AI_SERVICE_ID } from './services/ai/AIService.interface';
import { ChatGPTService } from './services/ai/ChatGPTService';
import {
  CHAT_APPROVAL_SERVICE_ID,
  DefaultChatApprovalService,
} from './services/chat/ChatApprovalService';
import { ChatMemoryManager } from './services/chat/ChatMemory';
import { CHAT_RESET_SERVICE_ID } from './services/chat/ChatResetService.interface';
import {
  CHAT_RESPONDER_ID,
  ChatResponder,
  DefaultChatResponder,
} from './services/chat/ChatResponder';
import { DefaultChatResetService } from './services/chat/DefaultChatResetService';
import {
  DefaultDialogueManager,
  DIALOGUE_MANAGER_ID,
} from './services/chat/DialogueManager';
import {
  DefaultHistorySummarizer,
  HISTORY_SUMMARIZER_ID,
} from './services/chat/HistorySummarizer';
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
  DefaultInterestChecker,
  INTEREST_CHECKER_ID,
} from './services/interest/InterestChecker';
import {
  DefaultMessageContextExtractor,
  MESSAGE_CONTEXT_EXTRACTOR_ID,
  MessageContextExtractor,
} from './services/messages/MessageContextExtractor';
import { MESSAGE_SERVICE_ID } from './services/messages/MessageService.interface';
import { RepositoryMessageService } from './services/messages/RepositoryMessageService';
import { FilePromptService } from './services/prompts/FilePromptService';
import { PROMPT_SERVICE_ID } from './services/prompts/PromptService.interface';
import { RepositorySummaryService } from './services/summaries/RepositorySummaryService';
import { SUMMARY_SERVICE_ID } from './services/summaries/SummaryService.interface';

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

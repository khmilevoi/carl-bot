import { type Container } from 'inversify';

import {
  ACCESS_KEY_REPOSITORY_ID,
  type AccessKeyRepository,
} from '../domain/repositories/AccessKeyRepository.interface';
import {
  CHAT_ACCESS_REPOSITORY_ID,
  type ChatAccessRepository,
} from '../domain/repositories/ChatAccessRepository.interface';
import {
  CHAT_CONFIG_REPOSITORY_ID,
  type ChatConfigRepository,
} from '../domain/repositories/ChatConfigRepository.interface';
import {
  CHAT_REPOSITORY_ID,
  type ChatRepository,
} from '../domain/repositories/ChatRepository.interface';
import {
  CHAT_USER_REPOSITORY_ID,
  type ChatUserRepository,
} from '../domain/repositories/ChatUserRepository.interface';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '../domain/repositories/DbProvider.interface';
import {
  MESSAGE_REPOSITORY_ID,
  type MessageRepository,
} from '../domain/repositories/MessageRepository.interface';
import {
  SUMMARY_REPOSITORY_ID,
  type SummaryRepository,
} from '../domain/repositories/SummaryRepository.interface';
import {
  USER_REPOSITORY_ID,
  type UserRepository,
} from '../domain/repositories/UserRepository.interface';
import { SQLiteDbProviderImpl } from '../infrastructure/persistence/sqlite/DbProvider';
import { SQLiteAccessKeyRepository } from '../infrastructure/persistence/sqlite/SQLiteAccessKeyRepository';
import { SQLiteChatAccessRepository } from '../infrastructure/persistence/sqlite/SQLiteChatAccessRepository';
import { SQLiteChatConfigRepository } from '../infrastructure/persistence/sqlite/SQLiteChatConfigRepository';
import { SQLiteChatRepository } from '../infrastructure/persistence/sqlite/SQLiteChatRepository';
import { SQLiteChatUserRepository } from '../infrastructure/persistence/sqlite/SQLiteChatUserRepository';
import { SQLiteMessageRepository } from '../infrastructure/persistence/sqlite/SQLiteMessageRepository';
import { SQLiteSummaryRepository } from '../infrastructure/persistence/sqlite/SQLiteSummaryRepository';
import { SQLiteUserRepository } from '../infrastructure/persistence/sqlite/SQLiteUserRepository';

export const register = (container: Container): void => {
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
};

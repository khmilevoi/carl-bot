import type { ServiceIdentifier } from 'inversify';

export interface ChatConfigEntity {
  chatId: number;
  historyLimit: number;
  interestInterval: number;
}

export interface ChatConfigRepository {
  upsert(config: ChatConfigEntity): Promise<void>;
  findById(chatId: number): Promise<ChatConfigEntity | undefined>;
}

export const CHAT_CONFIG_REPOSITORY_ID = Symbol.for(
  'ChatConfigRepository'
) as ServiceIdentifier<ChatConfigRepository>;

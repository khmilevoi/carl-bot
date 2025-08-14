import type { ServiceIdentifier } from 'inversify';

export interface ChatUserRepository {
  link(chatId: number, userId: number): Promise<void>;
  listByChat(chatId: number): Promise<number[]>;
}

export const CHAT_USER_REPOSITORY_ID = Symbol.for(
  'ChatUserRepository'
) as ServiceIdentifier<ChatUserRepository>;

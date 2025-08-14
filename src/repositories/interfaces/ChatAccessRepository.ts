import type { ServiceIdentifier } from 'inversify';

export type ChatStatus = 'pending' | 'approved' | 'banned';

export interface ChatAccessEntity {
  chatId: number;
  status: ChatStatus;
  requestedAt?: number;
  approvedAt?: number;
}

export interface ChatAccessRepository {
  get(chatId: number): Promise<ChatAccessEntity | undefined>;
  setStatus(chatId: number, status: ChatStatus): Promise<void>;
  listPending(): Promise<ChatAccessEntity[]>;
  listAll(): Promise<ChatAccessEntity[]>;
}

export const CHAT_ACCESS_REPOSITORY_ID = Symbol.for(
  'ChatAccessRepository'
) as ServiceIdentifier<ChatAccessRepository>;

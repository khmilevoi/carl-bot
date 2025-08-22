import type { ServiceIdentifier } from 'inversify';

import type {
  ChatAccessEntity,
  ChatStatus,
} from '@/domain/entities/ChatAccessEntity';

export interface ChatAccessRepository {
  get(chatId: number): Promise<ChatAccessEntity | undefined>;
  setStatus(chatId: number, status: ChatStatus): Promise<void>;
  listPending(): Promise<ChatAccessEntity[]>;
  listAll(): Promise<ChatAccessEntity[]>;
}

export const CHAT_ACCESS_REPOSITORY_ID = Symbol.for(
  'ChatAccessRepository'
) as ServiceIdentifier<ChatAccessRepository>;

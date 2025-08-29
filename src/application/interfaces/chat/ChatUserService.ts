import type { ServiceIdentifier } from 'inversify';

import type { UserEntity } from '@/domain/entities/UserEntity';

export interface ChatUserService {
  // Link a user to a chat (no-op if already linked)
  link(chatId: number, userId: number): Promise<void>;
  // List user ids that belong to a chat
  listUserIds(chatId: number): Promise<number[]>;
  // Load full user entities for chat members
  listUsers(chatId: number): Promise<UserEntity[]>;
}

export const CHAT_USER_SERVICE_ID = Symbol.for(
  'ChatUserService'
) as ServiceIdentifier<ChatUserService>;

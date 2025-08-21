import type { ServiceIdentifier } from 'inversify';

import type { ChatEntity } from '../entities/ChatEntity';

export interface ChatRepository {
  upsert(chat: ChatEntity): Promise<void>;
  findById(chatId: number): Promise<ChatEntity | undefined>;
}

export const CHAT_REPOSITORY_ID = Symbol.for(
  'ChatRepository'
) as ServiceIdentifier<ChatRepository>;

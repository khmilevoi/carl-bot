import type { ChatEntity } from '@/domain/entities/ChatEntity';

export interface ChatRepository {
  upsert(chat: ChatEntity): Promise<void>;
  findById(chatId: number): Promise<ChatEntity | undefined>;
}

export const CHAT_REPOSITORY_ID = Symbol('ChatRepository');

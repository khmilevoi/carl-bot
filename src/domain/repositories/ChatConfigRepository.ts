import type { ChatConfigEntity } from '@/domain/entities/ChatConfigEntity';

export interface ChatConfigRepository {
  upsert(config: ChatConfigEntity): Promise<void>;
  findById(chatId: number): Promise<ChatConfigEntity | undefined>;
}

export const CHAT_CONFIG_REPOSITORY_ID = Symbol('ChatConfigRepository');

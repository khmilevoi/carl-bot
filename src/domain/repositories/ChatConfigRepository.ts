import type { ChatConfigEntity } from '@/domain/entities/ChatConfigEntity';

export interface ChatConfigRepository {
  upsert(config: ChatConfigEntity): Promise<void>;
  findById(chatId: number): Promise<ChatConfigEntity | undefined>;
  findAll(): Promise<ChatConfigEntity[]>;
}

export const CHAT_CONFIG_REPOSITORY_ID = Symbol('ChatConfigRepository');

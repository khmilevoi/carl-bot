import { Message } from '@/services/storage/entities/Message';

export const MESSAGE_REPOSITORY_ID = Symbol('MessageRepository');

export interface MessageRepository {
  save(message: Message): Promise<Message>;
  findByChatId(chatId: number): Promise<Message[]>;
  deleteByChatId(chatId: number): Promise<void>;
}

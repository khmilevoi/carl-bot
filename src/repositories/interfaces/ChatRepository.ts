import type { ServiceIdentifier } from 'inversify';

export interface ChatEntity {
  chatId: number;
  title?: string | null;
}

export interface ChatRepository {
  upsert(chat: ChatEntity): Promise<void>;
  findById(chatId: number): Promise<ChatEntity | undefined>;
}

export const CHAT_REPOSITORY_ID = Symbol.for(
  'ChatRepository'
) as ServiceIdentifier<ChatRepository>;

export default ChatRepository;

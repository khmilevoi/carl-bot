import type { ServiceIdentifier } from 'inversify';

import type { ChatEntity } from '@/domain/entities/ChatEntity';

export interface ChatInfoService {
  saveChat(chat: ChatEntity): Promise<void>;
  getChat(chatId: number): Promise<ChatEntity | undefined>;
}

export const CHAT_INFO_SERVICE_ID = Symbol.for(
  'ChatInfoService'
) as ServiceIdentifier<ChatInfoService>;

import { inject, injectable } from 'inversify';

import type { ChatInfoService } from '@/application/interfaces/chat/ChatInfoService.interface';
import type { ChatEntity } from '@/domain/entities/ChatEntity';
import {
  CHAT_REPOSITORY_ID,
  type ChatRepository,
} from '@/domain/repositories/ChatRepository.interface';

@injectable()
export class RepositoryChatInfoService implements ChatInfoService {
  constructor(@inject(CHAT_REPOSITORY_ID) private repo: ChatRepository) {}

  async saveChat(chat: ChatEntity): Promise<void> {
    await this.repo.upsert(chat);
  }

  async getChat(chatId: number): Promise<ChatEntity | undefined> {
    return this.repo.findById(chatId);
  }
}

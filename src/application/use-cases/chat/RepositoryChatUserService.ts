import { inject, injectable } from 'inversify';

import type { ChatUserService } from '@/application/interfaces/chat/ChatUserService';
import type { UserEntity } from '@/domain/entities/UserEntity';
import {
  CHAT_USER_REPOSITORY_ID,
  type ChatUserRepository,
} from '@/domain/repositories/ChatUserRepository';
import {
  USER_REPOSITORY_ID,
  type UserRepository,
} from '@/domain/repositories/UserRepository';

@injectable()
export class RepositoryChatUserService implements ChatUserService {
  constructor(
    @inject(CHAT_USER_REPOSITORY_ID)
    private readonly chatUsers: ChatUserRepository,
    @inject(USER_REPOSITORY_ID) private readonly users: UserRepository
  ) {}

  async link(chatId: number, userId: number): Promise<void> {
    await this.chatUsers.link(chatId, userId);
  }

  async listUserIds(chatId: number): Promise<number[]> {
    return this.chatUsers.listByChat(chatId);
  }

  async listUsers(chatId: number): Promise<UserEntity[]> {
    const ids = await this.chatUsers.listByChat(chatId);
    if (ids.length === 0) return [];
    const users = await Promise.all(ids.map((id) => this.users.findById(id)));
    return users.filter((u): u is UserEntity => u !== undefined);
  }
}

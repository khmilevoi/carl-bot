import { inject, injectable } from 'inversify';

import {
  CHAT_REPOSITORY_ID,
  type ChatRepository,
} from '../../repositories/interfaces/ChatRepository';
import {
  MESSAGE_REPOSITORY_ID,
  type MessageRepository,
} from '../../repositories/interfaces/MessageRepository';
import {
  USER_REPOSITORY_ID,
  type UserRepository,
} from '../../repositories/interfaces/UserRepository';
import { logger } from '../logging/logger';
import { MessageService } from './MessageService';
import { StoredMessage } from './StoredMessage';

@injectable()
export class RepositoryMessageService implements MessageService {
  constructor(
    @inject(CHAT_REPOSITORY_ID) private chatRepo: ChatRepository,
    @inject(USER_REPOSITORY_ID) private userRepo: UserRepository,
    @inject(MESSAGE_REPOSITORY_ID) private messageRepo: MessageRepository
  ) {}

  async addMessage(message: StoredMessage) {
    logger.debug(
      { chatId: message.chatId, role: message.role },
      'Inserting message into database'
    );
    const storedUserId = message.userId ?? 0;
    await this.chatRepo.upsert({
      chatId: message.chatId,
      title: message.chatTitle ?? null,
    });
    await this.userRepo.upsert({
      id: storedUserId,
      username: message.username ?? null,
      firstName: message.firstName ?? null,
      lastName: message.lastName ?? null,
    });
    await this.messageRepo.insert({
      ...message,
      userId: storedUserId,
    });
  }

  async getMessages(chatId: number) {
    logger.debug({ chatId }, 'Fetching messages from database');
    return this.messageRepo.findByChatId(chatId);
  }

  async clearMessages(chatId: number) {
    logger.debug({ chatId }, 'Clearing messages table');
    await this.messageRepo.clearByChatId(chatId);
  }
}

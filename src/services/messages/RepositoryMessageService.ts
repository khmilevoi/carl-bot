import { inject, injectable } from 'inversify';

import {
  CHAT_REPOSITORY_ID,
  type ChatRepository,
} from '../../repositories/interfaces/ChatRepository.interface';
import {
  CHAT_USER_REPOSITORY_ID,
  type ChatUserRepository,
} from '../../repositories/interfaces/ChatUserRepository.interface';
import {
  MESSAGE_REPOSITORY_ID,
  type MessageRepository,
} from '../../repositories/interfaces/MessageRepository.interface';
import {
  USER_REPOSITORY_ID,
  type UserRepository,
} from '../../repositories/interfaces/UserRepository.interface';
import type { ChatMessage } from '../ai/AIService.interface';
import type Logger from '../logging/Logger.interface';
import {
  LOGGER_SERVICE_ID,
  type LoggerService,
} from '../logging/LoggerService';
import { MessageService } from './MessageService.interface';
import { StoredMessage } from './StoredMessage.interface';

@injectable()
export class RepositoryMessageService implements MessageService {
  private readonly logger: Logger;
  constructor(
    @inject(CHAT_REPOSITORY_ID) private chatRepo: ChatRepository,
    @inject(USER_REPOSITORY_ID) private userRepo: UserRepository,
    @inject(MESSAGE_REPOSITORY_ID) private messageRepo: MessageRepository,
    @inject(CHAT_USER_REPOSITORY_ID) private chatUserRepo: ChatUserRepository,
    @inject(LOGGER_SERVICE_ID) private loggerService: LoggerService
  ) {
    this.logger = this.loggerService.createLogger();
  }

  async addMessage(message: StoredMessage): Promise<void> {
    this.logger.debug('Inserting message into database', {
      chatId: message.chatId,
      role: message.role,
    });
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
    await this.chatUserRepo.link(message.chatId, storedUserId);
    await this.messageRepo.insert({
      ...message,
      userId: storedUserId,
    });
  }

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    this.logger.debug('Fetching messages from database', { chatId });
    return this.messageRepo.findByChatId(chatId);
  }

  async getCount(chatId: number): Promise<number> {
    this.logger.debug('Counting messages in database', { chatId });
    return this.messageRepo.countByChatId(chatId);
  }

  async getLastMessages(chatId: number, limit: number): Promise<ChatMessage[]> {
    this.logger.debug('Fetching last messages from database', {
      chatId,
      limit,
    });
    return this.messageRepo.findLastByChatId(chatId, limit);
  }

  async clearMessages(chatId: number): Promise<void> {
    this.logger.debug('Clearing messages table', { chatId });
    await this.messageRepo.clearByChatId(chatId);
  }
}

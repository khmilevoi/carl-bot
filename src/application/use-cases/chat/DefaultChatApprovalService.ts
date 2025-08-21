import { inject, injectable } from 'inversify';

import type {
  ChatAccessEntity,
  ChatStatus,
} from '../../../domain/entities/ChatAccessEntity';
import {
  CHAT_ACCESS_REPOSITORY_ID,
  type ChatAccessRepository,
} from '../../../domain/repositories/ChatAccessRepository.interface';
import { type ChatApprovalService } from '../../interfaces/chat/ChatApprovalService.interface';
import {
  type Env,
  ENV_SERVICE_ID,
  type EnvService,
} from '../../interfaces/env/EnvService.interface';
import type { Logger } from '../../interfaces/logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../../interfaces/logging/LoggerFactory.interface';

@injectable()
export class DefaultChatApprovalService implements ChatApprovalService {
  private env: Env;
  private readonly logger: Logger;

  constructor(
    @inject(CHAT_ACCESS_REPOSITORY_ID)
    private accessRepo: ChatAccessRepository,
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.env = envService.env;
    this.logger = loggerFactory.create('DefaultChatApprovalService');
  }

  async pending(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Setting status to pending');
    await this.accessRepo.setStatus(chatId, 'pending');
  }

  async approve(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Setting status to approved');
    await this.accessRepo.setStatus(chatId, 'approved');
  }

  async ban(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Setting status to banned');
    await this.accessRepo.setStatus(chatId, 'banned');
  }

  async unban(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Setting status to approved');
    await this.accessRepo.setStatus(chatId, 'approved');
  }

  async getStatus(chatId: number): Promise<ChatStatus> {
    const entity = await this.accessRepo.get(chatId);
    const status = entity?.status ?? 'pending';
    this.logger.debug({ chatId, status }, 'Retrieved chat status');
    return status;
  }

  async listAll(): Promise<ChatAccessEntity[]> {
    return this.accessRepo.listAll();
  }
}

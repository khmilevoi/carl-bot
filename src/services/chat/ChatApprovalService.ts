import { inject, injectable, type ServiceIdentifier } from 'inversify';

import {
  CHAT_ACCESS_REPOSITORY_ID,
  type ChatAccessEntity,
  type ChatAccessRepository,
  type ChatStatus,
} from '../../repositories/interfaces/ChatAccessRepository.interface';
import { type Env, ENV_SERVICE_ID, type EnvService } from '../env/EnvService';
import type Logger from '../logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../logging/LoggerFactory';

export interface ChatApprovalService {
  pending(chatId: number): Promise<void>;
  approve(chatId: number): Promise<void>;
  ban(chatId: number): Promise<void>;
  unban(chatId: number): Promise<void>;
  getStatus(chatId: number): Promise<ChatStatus>;
  listAll(): Promise<ChatAccessEntity[]>;
}

export const CHAT_APPROVAL_SERVICE_ID = Symbol.for(
  'ChatApprovalService'
) as ServiceIdentifier<ChatApprovalService>;

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

import { inject, injectable, type ServiceIdentifier } from 'inversify';

import {
  CHAT_ACCESS_REPOSITORY_ID,
  type ChatAccessEntity,
  type ChatAccessRepository,
  type ChatStatus,
} from '../../repositories/interfaces/ChatAccessRepository.interface';
import { type Env, ENV_SERVICE_ID, type EnvService } from '../env/EnvService';

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

  constructor(
    @inject(CHAT_ACCESS_REPOSITORY_ID)
    private accessRepo: ChatAccessRepository,
    @inject(ENV_SERVICE_ID) envService: EnvService
  ) {
    this.env = envService.env;
  }

  async pending(chatId: number): Promise<void> {
    await this.accessRepo.setStatus(chatId, 'pending');
  }

  async approve(chatId: number): Promise<void> {
    await this.accessRepo.setStatus(chatId, 'approved');
  }

  async ban(chatId: number): Promise<void> {
    await this.accessRepo.setStatus(chatId, 'banned');
  }

  async unban(chatId: number): Promise<void> {
    await this.accessRepo.setStatus(chatId, 'approved');
  }

  async getStatus(chatId: number): Promise<ChatStatus> {
    const entity = await this.accessRepo.get(chatId);
    return entity?.status ?? 'pending';
  }

  async listAll(): Promise<ChatAccessEntity[]> {
    return this.accessRepo.listAll();
  }
}

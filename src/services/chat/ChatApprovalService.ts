import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';

import {
  CHAT_ACCESS_REPOSITORY_ID,
  type ChatAccessRepository,
  type ChatStatus,
} from '../../repositories/interfaces/ChatAccessRepository';

export interface ChatApprovalService {
  request(chatId: number, title?: string): Promise<void>;
  approve(chatId: number): Promise<void>;
  ban(chatId: number): Promise<void>;
  unban(chatId: number): Promise<void>;
  getStatus(chatId: number): Promise<ChatStatus>;
}

export const CHAT_APPROVAL_SERVICE_ID = Symbol.for(
  'ChatApprovalService'
) as ServiceIdentifier<ChatApprovalService>;

@injectable()
export class DefaultChatApprovalService implements ChatApprovalService {
  constructor(
    @inject(CHAT_ACCESS_REPOSITORY_ID)
    private accessRepo: ChatAccessRepository
  ) {}

  async request(chatId: number, title?: string): Promise<void> {
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
}

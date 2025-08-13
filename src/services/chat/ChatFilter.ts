import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';

import { logger } from '../logging/logger';
import {
  CHAT_APPROVAL_SERVICE_ID,
  type ChatApprovalService,
} from './ChatApprovalService';

export interface ChatFilter {
  isAllowed(chatId: number): Promise<boolean>;
}

export const CHAT_FILTER_ID = Symbol.for(
  'ChatFilter'
) as ServiceIdentifier<ChatFilter>;

@injectable()
export class ChatApprovalChatFilter implements ChatFilter {
  constructor(
    @inject(CHAT_APPROVAL_SERVICE_ID)
    private approvalService: ChatApprovalService
  ) {}

  async isAllowed(chatId: number): Promise<boolean> {
    const status = await this.approvalService.getStatus(chatId);
    const allowed = status === 'approved';
    logger.debug({ chatId, allowed, status }, 'Checking chat access');
    if (!allowed && status === 'pending') {
      await this.approvalService.request(chatId);
    }
    return allowed;
  }
}

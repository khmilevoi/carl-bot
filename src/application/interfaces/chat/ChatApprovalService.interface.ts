import type { ServiceIdentifier } from 'inversify';

import type {
  ChatAccessEntity,
  ChatStatus,
} from '../../../domain/entities/ChatAccessEntity';

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

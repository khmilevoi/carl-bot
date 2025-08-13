import { inject, injectable, type ServiceIdentifier } from 'inversify';
import { Telegram } from 'telegraf';

import {
  CHAT_ACCESS_REPOSITORY_ID,
  type ChatAccessRepository,
  type ChatStatus,
} from '../../repositories/interfaces/ChatAccessRepository';
import { type Env, ENV_SERVICE_ID, type EnvService } from '../env/EnvService';

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
  private env: Env;
  private telegram: Telegram;

  constructor(
    @inject(CHAT_ACCESS_REPOSITORY_ID)
    private accessRepo: ChatAccessRepository,
    @inject(ENV_SERVICE_ID) envService: EnvService
  ) {
    this.env = envService.env;
    this.telegram = new Telegram(this.env.BOT_TOKEN);
  }

  async request(chatId: number, title?: string): Promise<void> {
    await this.accessRepo.setStatus(chatId, 'pending');
    const name = title ? `${title} (${chatId})` : `Chat ${chatId}`;
    await this.telegram.sendMessage(
      this.env.ADMIN_CHAT_ID,
      `${name} запросил доступ`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Разрешить', callback_data: `chat_approve:${chatId}` },
              { text: 'Забанить', callback_data: `chat_ban:${chatId}` },
            ],
          ],
        },
      }
    );
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

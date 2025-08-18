import { inject, injectable, type ServiceIdentifier } from 'inversify';

import {
  CHAT_CONFIG_REPOSITORY_ID,
  type ChatConfigEntity,
  type ChatConfigRepository,
} from '../../repositories/interfaces/ChatConfigRepository.interface';

export interface ChatConfigService {
  getConfig(chatId: number): Promise<ChatConfigEntity>;
  setHistoryLimit(chatId: number, historyLimit: number): Promise<void>;
  setInterestInterval(chatId: number, interestInterval: number): Promise<void>;
}

export const CHAT_CONFIG_SERVICE_ID = Symbol.for(
  'ChatConfigService'
) as ServiceIdentifier<ChatConfigService>;

const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_INTEREST_INTERVAL = 25;

@injectable()
export class RepositoryChatConfigService implements ChatConfigService {
  constructor(
    @inject(CHAT_CONFIG_REPOSITORY_ID) private repo: ChatConfigRepository
  ) {}

  async getConfig(chatId: number): Promise<ChatConfigEntity> {
    let config = await this.repo.findById(chatId);
    if (!config) {
      config = {
        chatId,
        historyLimit: DEFAULT_HISTORY_LIMIT,
        interestInterval: DEFAULT_INTEREST_INTERVAL,
      };
      await this.repo.upsert(config);
    }
    return config;
  }

  async setHistoryLimit(chatId: number, historyLimit: number): Promise<void> {
    if (
      !Number.isInteger(historyLimit) ||
      historyLimit <= 0 ||
      historyLimit > 50
    ) {
      throw new Error('Invalid history limit');
    }
    const config = await this.getConfig(chatId);
    await this.repo.upsert({ ...config, historyLimit });
  }

  async setInterestInterval(
    chatId: number,
    interestInterval: number
  ): Promise<void> {
    if (
      !Number.isInteger(interestInterval) ||
      interestInterval <= 0 ||
      interestInterval > 50
    ) {
      throw new Error('Invalid interest interval');
    }
    const config = await this.getConfig(chatId);
    await this.repo.upsert({ ...config, interestInterval });
  }
}

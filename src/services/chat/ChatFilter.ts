import { readFileSync } from 'fs';
import { inject, injectable } from 'inversify';
import { resolve } from 'path';

import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { logger } from '../logging/logger';

export interface ChatFilter {
  isAllowed(chatId: number): boolean;
}

import type { ServiceIdentifier } from 'inversify';

export const CHAT_FILTER_ID = Symbol.for(
  'ChatFilter'
) as ServiceIdentifier<ChatFilter>;

@injectable()
export class JSONWhiteListChatFilter implements ChatFilter {
  private ids = new Set<number>();
  private filename: string;

  constructor(@inject(ENV_SERVICE_ID) envService: EnvService) {
    this.filename = envService.getWhitelistFile();
    this.load();
  }

  private load() {
    try {
      const path = resolve(process.cwd(), this.filename);
      const data = JSON.parse(readFileSync(path, 'utf-8')) as number[];
      if (Array.isArray(data)) {
        this.ids = new Set(data.map((id) => Number(id)));
        logger.debug({ count: this.ids.size }, 'Loaded chat whitelist');
      }
    } catch {
      this.ids.clear();
      logger.warn('Failed to load chat whitelist');
    }
  }

  isAllowed(chatId: number): boolean {
    const allowed = this.ids.has(chatId);
    logger.debug({ chatId, allowed }, 'Checking chat access');
    return allowed;
  }
}

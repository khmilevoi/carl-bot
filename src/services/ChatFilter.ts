import { readFileSync } from 'fs';
import { resolve } from 'path';

import logger from './logger';

export interface ChatFilter {
  isAllowed(chatId: number): boolean;
}

export class JSONWhiteListChatFilter implements ChatFilter {
  private ids = new Set<number>();

  constructor(private filename: string) {
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

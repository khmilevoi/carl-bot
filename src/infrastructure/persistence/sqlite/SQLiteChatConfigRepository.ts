import { inject, injectable } from 'inversify';

import type { ChatConfigEntity } from '@/domain/entities/ChatConfigEntity';
import type { ChatConfigRepository } from '@/domain/repositories/ChatConfigRepository.interface';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider.interface';
import { BaseSQLiteRepository } from '@/infrastructure/persistence/sqlite/BaseSQLiteRepository';

@injectable()
export class SQLiteChatConfigRepository
  extends BaseSQLiteRepository
  implements ChatConfigRepository
{
  constructor(@inject(DB_PROVIDER_ID) dbProvider: DbProvider) {
    super(dbProvider);
  }

  async upsert({
    chatId,
    historyLimit,
    interestInterval,
  }: ChatConfigEntity): Promise<void> {
    const db = await this.db();
    await db.run(
      'INSERT INTO chat_configs (chat_id, history_limit, interest_interval) VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET history_limit=excluded.history_limit, interest_interval=excluded.interest_interval',
      chatId,
      historyLimit,
      interestInterval
    );
  }

  async findById(chatId: number): Promise<ChatConfigEntity | undefined> {
    const db = await this.db();
    const row = await db.get<{
      chat_id: number;
      history_limit: number;
      interest_interval: number;
    }>(
      'SELECT chat_id, history_limit, interest_interval FROM chat_configs WHERE chat_id = ?',
      chatId
    );
    return row
      ? {
          chatId: row.chat_id,
          historyLimit: row.history_limit,
          interestInterval: row.interest_interval,
        }
      : undefined;
  }
}

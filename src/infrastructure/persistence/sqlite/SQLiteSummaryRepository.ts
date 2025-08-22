import { inject, injectable } from 'inversify';

import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider.interface';
import type { SummaryRepository } from '@/domain/repositories/SummaryRepository.interface';
import { BaseSQLiteRepository } from '@/infrastructure/persistence/sqlite/BaseSQLiteRepository';

@injectable()
export class SQLiteSummaryRepository
  extends BaseSQLiteRepository
  implements SummaryRepository
{
  constructor(@inject(DB_PROVIDER_ID) dbProvider: DbProvider) {
    super(dbProvider);
  }
  async upsert(chatId: number, summary: string): Promise<void> {
    const db = await this.db();
    await db.run(
      'INSERT INTO summaries (chat_id, summary) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET summary=excluded.summary',
      chatId,
      summary
    );
  }

  async findById(chatId: number): Promise<string> {
    const db = await this.db();
    const row = await db.get<{ summary: string }>(
      'SELECT summary FROM summaries WHERE chat_id = ?',
      chatId
    );
    return row?.summary ?? '';
  }

  async clearByChatId(chatId: number): Promise<void> {
    const db = await this.db();
    await db.run('DELETE FROM summaries WHERE chat_id = ?', chatId);
  }
}

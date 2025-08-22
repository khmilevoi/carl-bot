import { inject, injectable } from 'inversify';

import {
  DB_PROVIDER_ID,
  type DbProvider,
  type SqlDatabase,
} from '@/domain/repositories/DbProvider.interface';
import type { SummaryRepository } from '@/domain/repositories/SummaryRepository.interface';

@injectable()
export class SQLiteSummaryRepository implements SummaryRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: DbProvider) {}
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

  private async db(): Promise<SqlDatabase> {
    return this.dbProvider.get();
  }
}

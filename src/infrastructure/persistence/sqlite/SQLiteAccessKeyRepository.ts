import { inject, injectable } from 'inversify';

import type { AccessKeyEntity } from '@/domain/entities/AccessKeyEntity';
import type { AccessKeyRepository } from '@/domain/repositories/AccessKeyRepository.interface';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider.interface';
import { BaseSQLiteRepository } from '@/infrastructure/persistence/sqlite/BaseSQLiteRepository';

@injectable()
export class SQLiteAccessKeyRepository
  extends BaseSQLiteRepository
  implements AccessKeyRepository
{
  constructor(@inject(DB_PROVIDER_ID) dbProvider: DbProvider) {
    super(dbProvider);
  }
  async upsertKey({
    chatId,
    userId,
    accessKey,
    expiresAt,
  }: AccessKeyEntity): Promise<void> {
    const db = await this.dbProvider.get();
    await db.run(
      'INSERT INTO access_keys (chat_id, user_id, access_key, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET access_key=excluded.access_key, expires_at=excluded.expires_at',
      chatId,
      userId,
      accessKey,
      expiresAt
    );
  }

  async findByChatAndUser(
    chatId: number,
    userId: number
  ): Promise<AccessKeyEntity | undefined> {
    const db = await this.dbProvider.get();
    const row = await db.get<{
      chat_id: number;
      user_id: number;
      access_key: string;
      expires_at: number;
    }>(
      'SELECT chat_id, user_id, access_key, expires_at FROM access_keys WHERE chat_id = ? AND user_id = ?',
      chatId,
      userId
    );
    return row
      ? {
          chatId: row.chat_id,
          userId: row.user_id,
          accessKey: row.access_key,
          expiresAt: row.expires_at,
        }
      : undefined;
  }

  async deleteExpired(now: number): Promise<void> {
    const db = await this.dbProvider.get();
    await db.run('DELETE FROM access_keys WHERE expires_at <= ?', now);
  }
}

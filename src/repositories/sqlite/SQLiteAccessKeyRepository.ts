import { inject, injectable } from 'inversify';

import { DB_PROVIDER_ID, type SQLiteDbProvider } from '../DbProvider';
import {
  type AccessKeyEntity,
  type AccessKeyRepository,
} from '../interfaces/AccessKeyRepository.interface';

@injectable()
export class SQLiteAccessKeyRepository implements AccessKeyRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: SQLiteDbProvider) {}
  async upsertKey({
    chatId,
    userId,
    accessKey,
    expiresAt,
  }: AccessKeyEntity): Promise<void> {
    const db = await this.db();
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
    const db = await this.db();
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
    const db = await this.db();
    await db.run('DELETE FROM access_keys WHERE expires_at <= ?', now);
  }

  private async db() {
    return this.dbProvider.get();
  }
}

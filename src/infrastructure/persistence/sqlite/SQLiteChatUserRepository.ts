import { inject, injectable } from 'inversify';

import type { ChatUserRepository } from '@/domain/repositories/ChatUserRepository.interface';
import {
  DB_PROVIDER_ID,
  type DbProvider,
  type SqlDatabase,
} from '@/domain/repositories/DbProvider.interface';

@injectable()
export class SQLiteChatUserRepository implements ChatUserRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: DbProvider) {}
  async link(chatId: number, userId: number): Promise<void> {
    const db = await this.db();
    await db.run(
      'INSERT OR IGNORE INTO chat_users (chat_id, user_id) VALUES (?, ?)',
      chatId,
      userId
    );
  }

  async listByChat(chatId: number): Promise<number[]> {
    const db = await this.db();
    const rows = await db.all<{
      user_id: number;
    }>('SELECT user_id FROM chat_users WHERE chat_id = ?', chatId);
    return (rows ?? []).map((row) => row.user_id);
  }

  private async db(): Promise<SqlDatabase> {
    return this.dbProvider.get();
  }
}

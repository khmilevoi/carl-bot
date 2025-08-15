import { inject, injectable } from 'inversify';
import type { Database } from 'sqlite';

import { DB_PROVIDER_ID, type SQLiteDbProvider } from '../DbProvider';
import { type ChatUserRepository } from '../interfaces/ChatUserRepository.interface';

@injectable()
export class SQLiteChatUserRepository implements ChatUserRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: SQLiteDbProvider) {}
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
    const rows = await db.all<
      {
        user_id: number;
      }[]
    >('SELECT user_id FROM chat_users WHERE chat_id = ?', chatId);
    return (rows ?? []).map((row) => row.user_id);
  }

  private async db(): Promise<Database> {
    return this.dbProvider.get();
  }
}

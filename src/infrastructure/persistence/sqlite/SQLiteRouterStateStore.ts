import { inject, injectable } from 'inversify';

import type {
  RouterState,
  StateStore,
} from '@/application/interfaces/router/StateStore';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider';

@injectable()
export class SQLiteRouterStateStore implements StateStore {
  constructor(
    @inject(DB_PROVIDER_ID) private readonly dbProvider: DbProvider
  ) {}

  async get(key: string): Promise<RouterState | undefined> {
    const { chatId, userId } = this.parseKey(key);
    const db = await this.dbProvider.get();
    const row = await db.get<{ state_json: string }>(
      'SELECT state_json FROM router_states WHERE chat_id = ? AND user_id = ?',
      chatId,
      userId
    );
    return row ? (JSON.parse(row.state_json) as RouterState) : undefined;
  }

  async set(key: string, state: RouterState): Promise<void> {
    const { chatId, userId } = this.parseKey(key);
    const db = await this.dbProvider.get();
    await db.run(
      'INSERT INTO router_states (chat_id, user_id, state_json) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET state_json = excluded.state_json',
      chatId,
      userId,
      JSON.stringify(state)
    );
  }

  async delete(key: string): Promise<void> {
    const { chatId, userId } = this.parseKey(key);
    const db = await this.dbProvider.get();
    await db.run(
      'DELETE FROM router_states WHERE chat_id = ? AND user_id = ?',
      chatId,
      userId
    );
  }

  private parseKey(key: string): { chatId: number; userId: number } {
    const [chat, user] = key.split(':');
    return { chatId: Number(chat), userId: Number(user) };
  }
}

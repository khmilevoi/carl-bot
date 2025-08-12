import { inject, injectable } from 'inversify';

import { DB_PROVIDER_ID, DbProvider } from '../DbProvider';
import {
  CHAT_REPOSITORY_ID,
  type ChatEntity,
  type ChatRepository,
} from '../interfaces/ChatRepository';

@injectable()
export class SQLiteChatRepository implements ChatRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: DbProvider) {}

  private async db() {
    return this.dbProvider.get();
  }

  async upsert({ chatId, title }: ChatEntity): Promise<void> {
    const db = await this.db();
    await db.run(
      'INSERT INTO chats (chat_id, title) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title',
      chatId,
      title ?? null
    );
  }

  async findById(chatId: number): Promise<ChatEntity | undefined> {
    const db = await this.db();
    const row = await db.get<{ chat_id: number; title: string | null }>(
      'SELECT chat_id, title FROM chats WHERE chat_id = ?',
      chatId
    );
    return row ? { chatId: row.chat_id, title: row.title } : undefined;
  }
}

export default SQLiteChatRepository;

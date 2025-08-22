import { inject, injectable } from 'inversify';

import type { ChatEntity } from '@/domain/entities/ChatEntity';
import type { ChatRepository } from '@/domain/repositories/ChatRepository.interface';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider.interface';
import { BaseSQLiteRepository } from '@/infrastructure/persistence/sqlite/BaseSQLiteRepository';

@injectable()
export class SQLiteChatRepository
  extends BaseSQLiteRepository
  implements ChatRepository
{
  constructor(@inject(DB_PROVIDER_ID) dbProvider: DbProvider) {
    super(dbProvider);
  }
  async upsert({ chatId, title }: ChatEntity): Promise<void> {
    const db = await this.dbProvider.get();
    await db.run(
      'INSERT INTO chats (chat_id, title) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title',
      chatId,
      title ?? null
    );
  }

  async findById(chatId: number): Promise<ChatEntity | undefined> {
    const db = await this.dbProvider.get();
    const row = await db.get<{ chat_id: number; title: string | null }>(
      'SELECT chat_id, title FROM chats WHERE chat_id = ?',
      chatId
    );
    return row ? { chatId: row.chat_id, title: row.title } : undefined;
  }
}

import { inject, injectable } from 'inversify';

import type {
  ChatAccessEntity,
  ChatStatus,
} from '@/domain/entities/ChatAccessEntity';
import type { ChatAccessRepository } from '@/domain/repositories/ChatAccessRepository';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider';

@injectable()
export class SQLiteChatAccessRepository implements ChatAccessRepository {
  constructor(
    @inject(DB_PROVIDER_ID) private readonly dbProvider: DbProvider
  ) {}
  async get(chatId: number): Promise<ChatAccessEntity | undefined> {
    const db = await this.dbProvider.get();
    const row = await db.get<{
      chat_id: number;
      status: ChatStatus;
      requested_at: number | null;
      approved_at: number | null;
    }>(
      'SELECT chat_id, status, requested_at, approved_at FROM chat_access WHERE chat_id = ?',
      chatId
    );
    return row
      ? {
          chatId: row.chat_id,
          status: row.status,
          requestedAt: row.requested_at ?? undefined,
          approvedAt: row.approved_at ?? undefined,
        }
      : undefined;
  }

  async setStatus(chatId: number, status: ChatStatus): Promise<void> {
    const db = await this.dbProvider.get();
    const now = Date.now();
    const requestedAt = status === 'pending' ? now : null;
    const approvedAt = status === 'approved' ? now : null;
    await db.run(
      'INSERT INTO chat_access (chat_id, status, requested_at, approved_at) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET status=excluded.status, requested_at=excluded.requested_at, approved_at=excluded.approved_at',
      chatId,
      status,
      requestedAt,
      approvedAt
    );
  }

  async listPending(): Promise<ChatAccessEntity[]> {
    const db = await this.dbProvider.get();
    const rows = await db.all<{
      chat_id: number;
      status: ChatStatus;
      requested_at: number | null;
      approved_at: number | null;
    }>(
      'SELECT chat_id, status, requested_at, approved_at FROM chat_access WHERE status = ?',
      'pending'
    );
    return (rows ?? []).map((row) => ({
      chatId: row.chat_id,
      status: row.status,
      requestedAt: row.requested_at ?? undefined,
      approvedAt: row.approved_at ?? undefined,
    }));
  }

  async listAll(): Promise<ChatAccessEntity[]> {
    const db = await this.dbProvider.get();
    const rows = await db.all<{
      chat_id: number;
      status: ChatStatus;
      requested_at: number | null;
      approved_at: number | null;
    }>('SELECT chat_id, status, requested_at, approved_at FROM chat_access');
    return (rows ?? []).map((row) => ({
      chatId: row.chat_id,
      status: row.status,
      requestedAt: row.requested_at ?? undefined,
      approvedAt: row.approved_at ?? undefined,
    }));
  }
}

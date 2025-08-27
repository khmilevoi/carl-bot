import { inject, injectable } from 'inversify';

import type { ChatConfigEntity } from '@/domain/entities/ChatConfigEntity';
import type { ChatConfigRepository } from '@/domain/repositories/ChatConfigRepository';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider';

@injectable()
export class SQLiteChatConfigRepository implements ChatConfigRepository {
  constructor(
    @inject(DB_PROVIDER_ID) private readonly dbProvider: DbProvider
  ) {}

  async upsert({
    chatId,
    historyLimit,
    interestInterval,
    topicTime,
  }: ChatConfigEntity): Promise<void> {
    const db = await this.dbProvider.get();
    await db.run(
      'INSERT INTO chat_configs (chat_id, history_limit, interest_interval, topic_time) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET history_limit=excluded.history_limit, interest_interval=excluded.interest_interval, topic_time=excluded.topic_time',
      chatId,
      historyLimit,
      interestInterval,
      topicTime
    );
  }

  async findById(chatId: number): Promise<ChatConfigEntity | undefined> {
    const db = await this.dbProvider.get();
    const row = await db.get<{
      chat_id: number;
      history_limit: number;
      interest_interval: number;
      topic_time: string;
    }>(
      'SELECT chat_id, history_limit, interest_interval, topic_time FROM chat_configs WHERE chat_id = ?',
      chatId
    );
    return row
      ? {
          chatId: row.chat_id,
          historyLimit: row.history_limit,
          interestInterval: row.interest_interval,
          topicTime: row.topic_time,
        }
      : undefined;
  }
}

import { injectable } from 'inversify';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

import { ChatMessage } from '../AIService';
import logger from '../logger';
import { MemoryStorage } from './MemoryStorage.interface';

@injectable()
export class SQLiteMemoryStorage implements MemoryStorage {
  private db: Promise<Database>;

  constructor(filename = 'memory.db') {
    this.db = open({ filename, driver: sqlite3.Database }).then((db) => {
      logger.debug({ filename }, 'Initializing SQLite storage');
      return db;
    });
  }

  private async getDb() {
    return this.db;
  }

  async addMessage(
    chatId: number,
    role: 'user' | 'assistant',
    content: string,
    username?: string
  ) {
    logger.debug({ chatId, role }, 'Inserting message into database');
    const db = await this.getDb();
    await db.run(
      'INSERT INTO messages (chat_id, role, content, username) VALUES (?, ?, ?, ?)',
      chatId,
      role,
      content,
      username ?? null
    );
  }

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    logger.debug({ chatId }, 'Fetching messages from database');
    const db = await this.getDb();
    const rows = await db.all<ChatMessage[]>(
      'SELECT role, content, username FROM messages WHERE chat_id = ? ORDER BY rowid',
      chatId
    );
    return rows ?? [];
  }

  async clearMessages(chatId: number) {
    logger.debug({ chatId }, 'Clearing messages table');
    const db = await this.getDb();
    await db.run('DELETE FROM messages WHERE chat_id = ?', chatId);
  }

  async getSummary(chatId: number) {
    logger.debug({ chatId }, 'Fetching summary');
    const db = await this.getDb();
    const row = await db.get<{ summary: string }>(
      'SELECT summary FROM summaries WHERE chat_id = ?',
      chatId
    );
    return row?.summary ?? '';
  }

  async setSummary(chatId: number, summary: string) {
    logger.debug({ chatId }, 'Storing summary');
    const db = await this.getDb();
    await db.run(
      'INSERT INTO summaries (chat_id, summary) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET summary=excluded.summary',
      chatId,
      summary
    );
  }

  async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat data');
    await this.clearMessages(chatId);
    await this.setSummary(chatId, '');
  }
}

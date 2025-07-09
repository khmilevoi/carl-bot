import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { MemoryStorage } from './MemoryStorage.interface';
import { ChatMessage } from '../ChatGPTService';

export class SQLiteMemoryStorage implements MemoryStorage {
  private db: Promise<Database>;

  constructor(filename = 'memory.db') {
    this.db = open({ filename, driver: sqlite3.Database }).then(async (db) => {
      await db.run(
        'CREATE TABLE IF NOT EXISTS messages (chat_id INTEGER, role TEXT, content TEXT)'
      );
      await db.run(
        'CREATE TABLE IF NOT EXISTS summaries (chat_id INTEGER PRIMARY KEY, summary TEXT)'
      );
      return db;
    });
  }

  private async getDb() {
    return this.db;
  }

  async addMessage(chatId: number, role: 'user' | 'assistant', content: string) {
    const db = await this.getDb();
    await db.run(
      'INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)',
      chatId,
      role,
      content
    );
  }

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    const db = await this.getDb();
    const rows = await db.all<ChatMessage[]>(
      'SELECT role, content FROM messages WHERE chat_id = ? ORDER BY rowid',
      chatId
    );
    return rows ?? [];
  }

  async clearMessages(chatId: number) {
    const db = await this.getDb();
    await db.run('DELETE FROM messages WHERE chat_id = ?', chatId);
  }

  async getSummary(chatId: number) {
    const db = await this.getDb();
    const row = await db.get<{ summary: string }>(
      'SELECT summary FROM summaries WHERE chat_id = ?',
      chatId
    );
    return row?.summary ?? '';
  }

  async setSummary(chatId: number, summary: string) {
    const db = await this.getDb();
    await db.run(
      'INSERT INTO summaries (chat_id, summary) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET summary=excluded.summary',
      chatId,
      summary
    );
  }

  async reset(chatId: number) {
    await this.clearMessages(chatId);
    await this.setSummary(chatId, '');
  }
} 
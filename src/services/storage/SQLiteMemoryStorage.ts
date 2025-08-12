import { inject, injectable } from 'inversify';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

import { parseDatabaseUrl } from '../../utils/database';
import { ChatMessage } from '../ai/AIService';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import logger from '../logging/logger';
import { MemoryStorage } from './MemoryStorage.interface';

@injectable()
export class SQLiteMemoryStorage implements MemoryStorage {
  private db: Promise<Database>;

  constructor(@inject(ENV_SERVICE_ID) envService: EnvService) {
    const filename = parseDatabaseUrl(envService.env.DATABASE_URL);
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
    username?: string,
    fullName?: string,
    replyText?: string,
    replyUsername?: string,
    quoteText?: string,
    userId?: number,
    messageId?: number,
    firstName?: string,
    lastName?: string,
    chatTitle?: string
  ) {
    logger.debug({ chatId, role }, 'Inserting message into database');
    const db = await this.getDb();
    const storedUserId = userId ?? 0;
    await db.run(
      'INSERT INTO chats (chat_id, title) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title',
      chatId,
      chatTitle ?? null
    );
    await db.run(
      'INSERT INTO users (id, username, first_name, last_name) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, last_name=excluded.last_name',
      storedUserId,
      username ?? null,
      firstName ?? null,
      lastName ?? null
    );
    await db.run(
      'INSERT INTO messages (chat_id, message_id, role, content, user_id, reply_text, reply_username, quote_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      chatId,
      messageId ?? null,
      role,
      content,
      storedUserId,
      replyText ?? null,
      replyUsername ?? null,
      quoteText ?? null
    );
  }

  async getMessages(chatId: number): Promise<ChatMessage[]> {
    logger.debug({ chatId }, 'Fetching messages from database');
    const db = await this.getDb();
    const rows = await db.all<
      {
        role: 'user' | 'assistant';
        content: string;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        reply_text: string | null;
        reply_username: string | null;
        quote_text: string | null;
      }[]
    >(
      'SELECT m.role, m.content, u.username, u.first_name, u.last_name, m.reply_text, m.reply_username, m.quote_text FROM messages m LEFT JOIN users u ON m.user_id = u.id WHERE m.chat_id = ? ORDER BY m.id',
      chatId
    );
    return (
      rows?.map((r) => {
        const entry: ChatMessage = {
          role: r.role,
          content: r.content,
        };
        if (r.username) entry.username = r.username;
        const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ');
        if (fullName) entry.fullName = fullName;
        if (r.reply_text) entry.replyText = r.reply_text;
        if (r.reply_username) entry.replyUsername = r.reply_username;
        if (r.quote_text) entry.quoteText = r.quote_text;
        return entry;
      }) ?? []
    );
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

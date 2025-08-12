import { randomBytes } from 'node:crypto';

import { injectable } from 'inversify';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

import { AdminService } from './AdminService';

@injectable()
export class SQLiteAdminService implements AdminService {
  private db: Promise<Database>;

  constructor(filename = 'memory.db') {
    this.db = open({ filename, driver: sqlite3.Database });
  }

  private async getDb() {
    return this.db;
  }

  async createAccessKey(
    chatId: number,
    userId: number,
    ttlMs = 24 * 60 * 60 * 1000
  ): Promise<Date> {
    const db = await this.getDb();
    const key = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + ttlMs;
    await db.run(
      'INSERT INTO access_keys (chat_id, user_id, access_key, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET access_key=excluded.access_key, expires_at=excluded.expires_at',
      chatId,
      userId,
      key,
      expiresAt
    );
    return new Date(expiresAt);
  }

  async hasAccess(chatId: number, userId: number): Promise<boolean> {
    const db = await this.getDb();
    const row = await db.get<{ expires_at: number }>(
      'SELECT expires_at FROM access_keys WHERE chat_id = ? AND user_id = ?',
      chatId,
      userId
    );
    if (!row) return false;
    if (row.expires_at < Date.now()) {
      await db.run(
        'DELETE FROM access_keys WHERE chat_id = ? AND user_id = ?',
        chatId,
        userId
      );
      return false;
    }
    return true;
  }

  async exportTables(): Promise<{ filename: string; buffer: Buffer }[]> {
    const db = await this.getDb();
    const tableRows = await db.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const files: { filename: string; buffer: Buffer }[] = [];
    for (const { name } of tableRows) {
      const buffer = await this.exportTable(db, name);
      if (buffer && buffer.length > 0) {
        files.push({ filename: `${name}.csv`, buffer });
      }
    }
    return files;
  }

  private async exportTable(
    db: Database,
    table: string
  ): Promise<Buffer | null> {
    const chunkSize = 100;
    let offset = 0;
    let header: string | undefined;
    const lines: string[] = [];
    while (true) {
      const rows = await db.all<any[]>(
        `SELECT * FROM ${table} LIMIT ? OFFSET ?`,
        chunkSize,
        offset
      );
      if (rows.length === 0) break;
      if (!header) {
        header = Object.keys(rows[0]).join(',');
      }
      for (const row of rows) {
        const line = Object.keys(row)
          .map((k) => JSON.stringify(row[k] ?? ''))
          .join(',');
        lines.push(line);
      }
      offset += rows.length;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    if (!header) {
      return null;
    }
    const csv = header + '\n' + lines.join('\n');
    return Buffer.from(csv);
  }
}

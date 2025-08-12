import { randomBytes } from 'node:crypto';

import { injectable } from 'inversify';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

@injectable()
export class AdminService {
  private db: Promise<Database>;

  constructor(filename = 'memory.db') {
    this.db = open({ filename, driver: sqlite3.Database });
  }

  private async getDb() {
    return this.db;
  }

  async createAccessKey(chatId: number): Promise<string> {
    const db = await this.getDb();
    const key = randomBytes(16).toString('hex');
    await db.run(
      'INSERT INTO access_keys (chat_id, access_key) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET access_key=excluded.access_key',
      chatId,
      key
    );
    return key;
  }

  async validateAccess(chatId: number, key: string): Promise<boolean> {
    const db = await this.getDb();
    const row = await db.get<{ access_key: string }>(
      'SELECT access_key FROM access_keys WHERE chat_id = ?',
      chatId
    );
    return row?.access_key === key;
  }

  async hasAccess(chatId: number): Promise<boolean> {
    const db = await this.getDb();
    const row = await db.get<{ access_key: string }>(
      'SELECT access_key FROM access_keys WHERE chat_id = ?',
      chatId
    );
    return !!row;
  }

  async exportTables(): Promise<{ filename: string; buffer: Buffer }[]> {
    const db = await this.getDb();
    const tableRows = await db.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const files: { filename: string; buffer: Buffer }[] = [];
    for (const { name } of tableRows) {
      const buffer = await this.exportTable(db, name);
      files.push({ filename: `${name}.csv`, buffer });
    }
    return files;
  }

  private async exportTable(db: Database, table: string): Promise<Buffer> {
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
    const csv = header ? header + '\n' + lines.join('\n') : '';
    return Buffer.from(csv);
  }
}

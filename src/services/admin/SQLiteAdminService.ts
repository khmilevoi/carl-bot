import { randomBytes } from 'node:crypto';

import { inject, injectable } from 'inversify';
import type { Database } from 'sqlite';

import { DB_PROVIDER_ID, DbProvider } from '../../repositories/DbProvider';
import {
  ACCESS_KEY_REPOSITORY_ID,
  type AccessKeyRepository,
} from '../../repositories/interfaces/AccessKeyRepository';
import { AdminService } from './AdminService';

@injectable()
export class SQLiteAdminService implements AdminService {
  constructor(
    @inject(DB_PROVIDER_ID) private dbProvider: DbProvider,
    @inject(ACCESS_KEY_REPOSITORY_ID)
    private accessKeyRepo: AccessKeyRepository
  ) {}

  async createAccessKey(
    chatId: number,
    userId: number,
    ttlMs = 24 * 60 * 60 * 1000
  ): Promise<Date> {
    const key = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + ttlMs;
    await this.accessKeyRepo.upsert({
      chatId,
      userId,
      accessKey: key,
      expiresAt,
    });
    return new Date(expiresAt);
  }

  async hasAccess(chatId: number, userId: number): Promise<boolean> {
    const entry = await this.accessKeyRepo.find(chatId, userId);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      await this.accessKeyRepo.delete(chatId, userId);
      return false;
    }
    return true;
  }

  async exportTables(): Promise<{ filename: string; buffer: Buffer }[]> {
    const db = await this.dbProvider.get();
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

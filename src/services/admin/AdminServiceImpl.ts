import { randomBytes } from 'node:crypto';

import { inject, injectable } from 'inversify';
import type { Database } from 'sqlite';

import {
  DB_PROVIDER_ID,
  type SQLiteDbProvider,
} from '../../repositories/DbProvider';
import {
  ACCESS_KEY_REPOSITORY_ID,
  type AccessKeyRepository,
} from '../../repositories/interfaces/AccessKeyRepository';
import { AdminService } from './AdminService';

@injectable()
export class AdminServiceImpl implements AdminService {
  constructor(
    @inject(DB_PROVIDER_ID) private dbProvider: SQLiteDbProvider,
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
    await this.accessKeyRepo.upsertKey({
      chatId,
      userId,
      accessKey: key,
      expiresAt,
    });
    return new Date(expiresAt);
  }

  async hasAccess(chatId: number, userId: number): Promise<boolean> {
    await this.accessKeyRepo.deleteExpired(Date.now());
    const entry = await this.accessKeyRepo.findByChatAndUser(chatId, userId);
    return entry !== undefined;
  }

  async exportTables(): Promise<{ filename: string; buffer: Buffer }[]> {
    const db = await this.dbProvider.get();
    const tableNames = await this.dbProvider.listTables();
    const files: { filename: string; buffer: Buffer }[] = [];
    for (const name of tableNames) {
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

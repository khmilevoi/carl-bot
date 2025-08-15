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
} from '../../repositories/interfaces/AccessKeyRepository.interface';
import {
  CHAT_USER_REPOSITORY_ID,
  type ChatUserRepository,
} from '../../repositories/interfaces/ChatUserRepository.interface';
import {
  MESSAGE_REPOSITORY_ID,
  type MessageRepository,
} from '../../repositories/interfaces/MessageRepository.interface';
import {
  SUMMARY_REPOSITORY_ID,
  type SummaryRepository,
} from '../../repositories/interfaces/SummaryRepository.interface';
import {
  USER_REPOSITORY_ID,
  type UserEntity,
  type UserRepository,
} from '../../repositories/interfaces/UserRepository.interface';
import type { ChatMessage } from '../ai/AIService.interface';
import { AdminService } from './AdminService.interface';

@injectable()
export class AdminServiceImpl implements AdminService {
  constructor(
    @inject(DB_PROVIDER_ID) private dbProvider: SQLiteDbProvider,
    @inject(ACCESS_KEY_REPOSITORY_ID)
    private accessKeyRepo: AccessKeyRepository,
    @inject(MESSAGE_REPOSITORY_ID) private messageRepo: MessageRepository,
    @inject(SUMMARY_REPOSITORY_ID) private summaryRepo: SummaryRepository,
    @inject(CHAT_USER_REPOSITORY_ID) private chatUserRepo: ChatUserRepository,
    @inject(USER_REPOSITORY_ID) private userRepo: UserRepository
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
      if (buffer !== null && buffer.length > 0) {
        files.push({ filename: `${name}.csv`, buffer });
      }
    }
    return files;
  }

  async exportChatData(
    chatId: number
  ): Promise<{ filename: string; buffer: Buffer }[]> {
    const files: { filename: string; buffer: Buffer }[] = [];

    const messages = await this.messageRepo.findByChatId(chatId);
    if (messages.length > 0) {
      const header: (keyof ChatMessage)[] = [
        'role',
        'content',
        'username',
        'fullName',
        'replyText',
        'replyUsername',
        'quoteText',
        'userId',
        'messageId',
        'attitude',
        'chatId',
      ];
      const lines = messages.map((m) =>
        header.map((h) => JSON.stringify(m[h] ?? '')).join(',')
      );
      const csv = header.join(',') + '\n' + lines.join('\n');
      files.push({ filename: 'messages.csv', buffer: Buffer.from(csv) });
    }

    const summary = await this.summaryRepo.findById(chatId);
    if (summary) {
      const csv = 'chat_id,summary\n' + `${chatId},${JSON.stringify(summary)}`;
      files.push({ filename: 'summaries.csv', buffer: Buffer.from(csv) });
    }

    const userIds = await this.chatUserRepo.listByChat(chatId);
    if (userIds.length > 0) {
      const users = await Promise.all(
        userIds.map((id) => this.userRepo.findById(id))
      );
      const existing = users.filter((u): u is UserEntity => u !== undefined);
      if (existing.length > 0) {
        const header: (keyof UserEntity)[] = [
          'id',
          'username',
          'firstName',
          'lastName',
          'attitude',
        ];
        const lines = existing.map((u) =>
          header.map((h) => JSON.stringify(u[h] ?? '')).join(',')
        );
        const csv = header.join(',') + '\n' + lines.join('\n');
        files.push({ filename: 'users.csv', buffer: Buffer.from(csv) });
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
      const rows: Record<string, unknown>[] = await db.all(
        `SELECT * FROM ${table} LIMIT ? OFFSET ?`,
        chunkSize,
        offset
      );
      if (rows.length === 0) break;
      header ??= Object.keys(rows[0]).join(',');
      for (const row of rows) {
        const line = Object.keys(row)
          .map((k) => JSON.stringify(row[k] ?? ''))
          .join(',');
        lines.push(line);
      }
      offset += rows.length;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    if (header === undefined) {
      return null;
    }
    const csv = header + '\n' + lines.join('\n');
    return Buffer.from(csv);
  }
}

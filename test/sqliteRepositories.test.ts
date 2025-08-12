import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import DbProvider from '../src/repositories/DbProvider';
import SQLiteAccessKeyRepository from '../src/repositories/sqlite/SQLiteAccessKeyRepository';
import SQLiteChatRepository from '../src/repositories/sqlite/SQLiteChatRepository';
import SQLiteMessageRepository from '../src/repositories/sqlite/SQLiteMessageRepository';
import SQLiteSummaryRepository from '../src/repositories/sqlite/SQLiteSummaryRepository';
import SQLiteUserRepository from '../src/repositories/sqlite/SQLiteUserRepository';
import { TestEnvService } from '../src/services/env/EnvService';
import { parseDatabaseUrl } from '../src/utils/database';

let chatRepo: SQLiteChatRepository;
let userRepo: SQLiteUserRepository;
let messageRepo: SQLiteMessageRepository;
let summaryRepo: SQLiteSummaryRepository;
let accessKeyRepo: SQLiteAccessKeyRepository;

beforeEach(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sqlite-'));
  const dbFile = path.join(dir, 'test.db');
  process.env.DATABASE_URL = `file://${dbFile}`;
  const env = new TestEnvService();
  const filename = parseDatabaseUrl(env.env.DATABASE_URL);
  const db = await open({ filename, driver: sqlite3.Database });
  await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT
      );
      CREATE TABLE chats (
        chat_id INTEGER PRIMARY KEY,
        title TEXT
      );
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        message_id INTEGER,
        role TEXT,
        content TEXT,
        user_id INTEGER NOT NULL,
        reply_text TEXT,
        reply_username TEXT,
        quote_text TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(chat_id) REFERENCES chats(chat_id)
      );
      CREATE TABLE summaries (
        chat_id INTEGER PRIMARY KEY,
        summary TEXT
      );
      CREATE TABLE access_keys (
        chat_id INTEGER,
        user_id INTEGER,
        access_key TEXT,
        expires_at INTEGER,
        PRIMARY KEY(chat_id, user_id)
      );
    `);
  await db.close();
  const provider = new DbProvider(env);
  chatRepo = new SQLiteChatRepository(provider);
  userRepo = new SQLiteUserRepository(provider);
  messageRepo = new SQLiteMessageRepository(provider);
  summaryRepo = new SQLiteSummaryRepository(provider);
  accessKeyRepo = new SQLiteAccessKeyRepository(provider);
});

describe('SQLite repositories', () => {
  it('adds and retrieves messages', async () => {
    await chatRepo.upsert({ chatId: 1 });
    await userRepo.upsert({
      id: 1,
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    await messageRepo.insert({
      chatId: 1,
      role: 'user',
      content: 'hi',
      userId: 1,
      messageId: 11,
    });
    await userRepo.upsert({ id: 0, username: 'bot' });
    await messageRepo.insert({
      chatId: 1,
      role: 'assistant',
      content: 'hello',
      userId: 0,
    });
    const messages = await messageRepo.findByChatId(1);
    expect(messages).toEqual([
      {
        role: 'user',
        content: 'hi',
        username: 'alice',
        fullName: 'Alice Smith',
        userId: 1,
        messageId: 11,
        chatId: 1,
      },
      { role: 'assistant', content: 'hello', username: 'bot', chatId: 1 },
    ]);
  });

  it('clears messages', async () => {
    await chatRepo.upsert({ chatId: 1 });
    await userRepo.upsert({ id: 1, username: 'alice' });
    await messageRepo.insert({
      chatId: 1,
      role: 'user',
      content: 'hi',
      userId: 1,
    });
    await messageRepo.clearByChatId(1);
    const messages = await messageRepo.findByChatId(1);
    expect(messages).toEqual([]);
  });

  it('stores and retrieves summary', async () => {
    await summaryRepo.upsert(1, 'summary');
    expect(await summaryRepo.findById(1)).toBe('summary');
  });

  it('resets messages and summary', async () => {
    await chatRepo.upsert({ chatId: 1 });
    await userRepo.upsert({ id: 1, username: 'alice' });
    await messageRepo.insert({
      chatId: 1,
      role: 'user',
      content: 'hi',
      userId: 1,
    });
    await summaryRepo.upsert(1, 'summary');
    await messageRepo.clearByChatId(1);
    await summaryRepo.clearByChatId(1);
    const messages = await messageRepo.findByChatId(1);
    expect(messages).toEqual([]);
    expect(await summaryRepo.findById(1)).toBe('');
  });

  it('stores and updates users', async () => {
    await userRepo.upsert({
      id: 42,
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    await userRepo.upsert({
      id: 42,
      username: 'alice2',
      firstName: 'Alicia',
      lastName: 'Johnson',
    });
    const user = await userRepo.findById(42);
    expect(user).toEqual({
      id: 42,
      username: 'alice2',
      firstName: 'Alicia',
      lastName: 'Johnson',
    });
  });

  it('stores chats', async () => {
    await chatRepo.upsert({ chatId: 1, title: 'Test Chat' });
    const chat = await chatRepo.findById(1);
    expect(chat).toEqual({ chatId: 1, title: 'Test Chat' });
  });

  it('stores and retrieves access keys', async () => {
    const expiresAt = Date.now() + 1000;
    await accessKeyRepo.upsert({
      chatId: 1,
      userId: 2,
      accessKey: 'key',
      expiresAt,
    });
    const entry = await accessKeyRepo.find(1, 2);
    expect(entry).toEqual({
      chatId: 1,
      userId: 2,
      accessKey: 'key',
      expiresAt,
    });
    await accessKeyRepo.delete(1, 2);
    expect(await accessKeyRepo.find(1, 2)).toBeUndefined();
  });
});

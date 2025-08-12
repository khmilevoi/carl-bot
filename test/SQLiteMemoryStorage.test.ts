import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { TestEnvService } from '../src/services/env/EnvService';
import { SQLiteMemoryStorage } from '../src/services/storage/SQLiteMemoryStorage';
import { parseDatabaseUrl } from '../src/utils/database';

let storage: SQLiteMemoryStorage;

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
    `);
  await db.close();
  storage = new SQLiteMemoryStorage(env);
});

describe('SQLiteMemoryStorage', () => {
  it('adds and retrieves messages', async () => {
    await storage.addMessage(
      1,
      'user',
      'hi',
      'alice',
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      11,
      'Alice',
      'Smith'
    );
    await storage.addMessage(1, 'assistant', 'hello', 'bot');
    const messages = await storage.getMessages(1);
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
    await storage.addMessage(1, 'user', 'hi', 'alice');
    await storage.clearMessages(1);
    const messages = await storage.getMessages(1);
    expect(messages).toEqual([]);
  });

  it('stores and retrieves summary', async () => {
    await storage.setSummary(1, 'summary');
    expect(await storage.getSummary(1)).toBe('summary');
  });

  it('resets messages and summary', async () => {
    await storage.addMessage(1, 'user', 'hi', 'alice');
    await storage.setSummary(1, 'summary');
    await storage.reset(1);
    const messages = await storage.getMessages(1);
    expect(messages).toEqual([]);
    expect(await storage.getSummary(1)).toBe('');
  });

  it('stores and updates users', async () => {
    await storage.addMessage(
      1,
      'user',
      'hi',
      'alice',
      undefined,
      undefined,
      undefined,
      undefined,
      42,
      undefined,
      'Alice',
      'Smith'
    );
    await storage.addMessage(
      1,
      'user',
      'hi again',
      'alice2',
      undefined,
      undefined,
      undefined,
      undefined,
      42,
      undefined,
      'Alicia',
      'Johnson'
    );
    const env = new TestEnvService();
    const filename = parseDatabaseUrl(env.env.DATABASE_URL);
    const db = await open({ filename, driver: sqlite3.Database });
    const user = await db.get(
      'SELECT id, username, first_name, last_name FROM users WHERE id = ?',
      42
    );
    await db.close();
    expect(user).toEqual({
      id: 42,
      username: 'alice2',
      first_name: 'Alicia',
      last_name: 'Johnson',
    });
  });

  it('stores chats', async () => {
    await storage.addMessage(
      1,
      'user',
      'hi',
      'alice',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'Test Chat'
    );
    const env = new TestEnvService();
    const filename = parseDatabaseUrl(env.env.DATABASE_URL);
    const db = await open({ filename, driver: sqlite3.Database });
    const chat = await db.get(
      'SELECT chat_id, title FROM chats WHERE chat_id = ?',
      1
    );
    await db.close();
    expect(chat).toEqual({ chat_id: 1, title: 'Test Chat' });
  });
});

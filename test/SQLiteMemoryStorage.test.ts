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
    CREATE TABLE messages (
      chat_id INTEGER,
      role TEXT,
      content TEXT,
      username TEXT,
      full_name TEXT,
      reply_text TEXT,
      reply_username TEXT,
      quote_text TEXT
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
    await storage.addMessage(1, 'user', 'hi', 'alice');
    await storage.addMessage(1, 'assistant', 'hello', 'bot');
    const messages = await storage.getMessages(1);
    expect(messages).toEqual([
      { role: 'user', content: 'hi', username: 'alice' },
      { role: 'assistant', content: 'hello', username: 'bot' },
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
});

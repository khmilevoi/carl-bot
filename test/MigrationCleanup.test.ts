import { existsSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const dbPath = path.resolve('migration-test.db');
let migrateUp: () => Promise<void>;

async function loadMigrateModule() {
  const mod = await import('../src/migrate');
  migrateUp = mod.migrateUp;
}

describe('migrateUp', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = `file://./${path.basename(dbPath)}`;
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
    await loadMigrateModule();
    await migrateUp();
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    await db.run(
      'INSERT INTO migrations (id, applied_at) VALUES (?, datetime("now"))',
      '999_fake'
    );
    await db.close();
  });

  afterEach(() => {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  it('removes unknown migrations before applying new ones', async () => {
    await migrateUp();
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    const rows = await db.all('SELECT id FROM migrations');
    const ids = rows.map((r: { id: string }) => r.id);
    expect(ids).not.toContain('999_fake');
    const migrationFiles = readdirSync('migrations').filter((f) =>
      f.endsWith('.up.sql')
    );
    expect(ids.length).toBe(migrationFiles.length);
    await db.close();
  });
});

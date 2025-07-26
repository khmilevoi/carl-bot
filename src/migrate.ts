import { existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

import logger from './services/logger';

interface Migration {
  id: string;
  up: string;
  down: string;
}

function loadMigrations(dir = 'migrations'): Migration[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();
  return files.map((upFile) => {
    const id = upFile.replace('.up.sql', '');
    const downFile = id + '.down.sql';
    return {
      id,
      up: readFileSync(join(dir, upFile), 'utf8'),
      down: readFileSync(join(dir, downFile), 'utf8'),
    };
  });
}

async function getDb() {
  const url = process.env.DATABASE_URL ?? 'file:memory.db';
  const filename = url.replace(/^file:\/\//, '');
  return open({ filename, driver: sqlite3.Database });
}

async function ensureTable(db: any) {
  await db.run(
    'CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT)'
  );
}

async function appliedMigrations(db: any): Promise<string[]> {
  const rows = await db.all<{ id: string }[]>('SELECT id FROM migrations');
  return rows.map((r) => r.id);
}

async function migrateUp() {
  let db = await getDb();
  const table = await db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
  );
  if (!table) {
    await db.close();
    const url = process.env.DATABASE_URL ?? 'file:memory.db';
    const filename = url.replace(/^file:\/\//, '');
    if (existsSync(filename)) {
      unlinkSync(filename);
    }
    db = await getDb();
  }
  await ensureTable(db);
  const applied = await appliedMigrations(db);
  const migrations = loadMigrations();
  for (const m of migrations) {
    if (applied.includes(m.id)) continue;
    logger.info({ id: m.id }, 'Applying migration');
    await db.exec(m.up);
    await db.run(
      'INSERT INTO migrations (id, applied_at) VALUES (?, datetime("now"))',
      m.id
    );
  }
  await db.close();
}

async function migrateDown() {
  const db = await getDb();
  await ensureTable(db);
  const applied = await appliedMigrations(db);
  if (applied.length === 0) {
    logger.info('No migrations to revert');
    await db.close();
    return;
  }
  const migrations = loadMigrations();
  const lastId = applied[applied.length - 1];
  const m = migrations.find((x) => x.id === lastId);
  if (!m) {
    logger.error({ id: lastId }, 'Migration file not found');
    await db.close();
    return;
  }
  logger.info({ id: m.id }, 'Reverting migration');
  await db.exec(m.down);
  await db.run('DELETE FROM migrations WHERE id = ?', m.id);
  await db.close();
}

const direction = process.argv[2];
if (direction === 'down') {
  migrateDown().catch((e) => {
    logger.error(e, 'Migration failed');
    process.exit(1);
  });
} else {
  migrateUp().catch((e) => {
    logger.error(e, 'Migration failed');
    process.exit(1);
  });
}

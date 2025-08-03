import 'dotenv/config';

import assert from 'node:assert';

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

import logger from '@/services/logging/logger';
import { parseDatabaseUrl } from '@/utils/database';

interface Migration {
  id: string;
  up: string;
  down: string;
}

const filename = parseDatabaseUrl(process.env.DATABASE_URL);

function loadMigrations(dir = 'migrations'): Migration[] {
  logger.info({ dir }, 'Loading migrations from directory');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();
  logger.info({ count: files.length }, 'Migration files found');
  return files.map((upFile) => {
    const id = upFile.replace('.up.sql', '');
    const downFile = id + '.down.sql';
    logger.debug({ id, upFile, downFile }, 'Loading migration');
    return {
      id,
      up: readFileSync(join(dir, upFile), 'utf8'),
      down: readFileSync(join(dir, downFile), 'utf8'),
    };
  });
}

async function getDb() {
  logger.info({ filename }, 'Connecting to database');
  return open({ filename, driver: sqlite3.Database });
}

async function ensureTable(db: any) {
  logger.debug('Checking for migrations table');
  await db.run(
    'CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT)'
  );
  logger.debug('Migrations table ready');
}

async function appliedMigrations(db: any): Promise<string[]> {
  logger.debug('Fetching applied migrations list');
  const rows = (await db.all('SELECT id FROM migrations')) as { id: string }[];
  const applied = rows.map((r: { id: string }) => r.id);
  logger.info({ count: applied.length, applied }, 'Applied migrations found');
  return applied;
}

async function clearDatabase(db: any) {
  logger.info('Clearing database');

  const tables = (await db.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  )) as { name: string }[];

  if (tables.length > 0) {
    logger.info(
      {
        count: tables.length,
        tables: tables.map((t: { name: string }) => t.name),
      },
      'Tables found for removal'
    );

    for (const tableInfo of tables) {
      try {
        logger.debug({ table: tableInfo.name }, 'Dropping table');
        await db.exec(`DROP TABLE IF EXISTS "${tableInfo.name}"`);
        logger.debug({ table: tableInfo.name }, 'Table dropped');
      } catch (error) {
        logger.warn({ table: tableInfo.name, error }, 'Failed to drop table');
      }
    }

    logger.info('All tables dropped');
  } else {
    logger.debug('No tables found for removal');
  }
}

async function migrateUp() {
  logger.info('Starting migration process (UP)');

  let db = await getDb();
  const table = await db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
  );
  logger.info({ table }, 'Checking migrations table');
  if (!table) {
    logger.info('Migrations table not found, clearing database');
    await db.close();

    db = await getDb();
    await clearDatabase(db);
    await db.close();
    db = await getDb();
  } else {
    logger.debug('Migrations table found');
  }

  await ensureTable(db);
  const applied = await appliedMigrations(db);
  const migrations = loadMigrations();

  logger.info(
    { total: migrations.length, applied: applied.length },
    'Analyzing migrations'
  );

  const pendingMigrations = migrations.filter((m) => !applied.includes(m.id));
  logger.info({ count: pendingMigrations.length }, 'Migrations to apply');

  for (const m of pendingMigrations) {
    logger.info({ id: m.id }, 'Applying migration');
    try {
      await db.exec(m.up);
      await db.run(
        'INSERT INTO migrations (id, applied_at) VALUES (?, datetime("now"))',
        m.id
      );
      logger.info({ id: m.id }, 'Migration applied successfully');
    } catch (error) {
      logger.error({ id: m.id, error }, 'Error applying migration');
      throw error;
    }
  }

  logger.info('All migrations applied successfully');
  await db.close();
}

async function migrateDown() {
  logger.info('Starting migration rollback (DOWN)');

  const db = await getDb();
  await ensureTable(db);
  const applied = await appliedMigrations(db);

  if (applied.length === 0) {
    logger.info('No migrations to rollback');
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

  logger.info({ id: m.id }, 'Rolling back last migration');
  try {
    await db.exec(m.down);
    await db.run('DELETE FROM migrations WHERE id = ?', m.id);
    logger.info({ id: m.id }, 'Migration rolled back successfully');
  } catch (error) {
    logger.error({ id: m.id, error }, 'Error rolling back migration');
    throw error;
  }

  await db.close();
}

async function checkMigrations() {
  logger.info('Checking migration status');

  const db = await getDb();
  await ensureTable(db);
  const applied = await appliedMigrations(db);
  const migrations = loadMigrations();

  logger.info(
    { total: migrations.length, applied: applied.length },
    'Migration status'
  );

  const pendingMigrations = migrations.filter((m) => !applied.includes(m.id));

  if (pendingMigrations.length === 0) {
    logger.info('All migrations applied');
    await db.close();
    return true;
  } else {
    logger.info(
      { count: pendingMigrations.length },
      'Unapplied migrations exist'
    );
    await db.close();
    return false;
  }
}

const direction = process.argv[2];
logger.info({ direction }, 'Running migrations');

if (direction === 'down') {
  migrateDown().catch((e) => {
    logger.error(e, 'Migration DOWN failed');
    process.exit(1);
  });
} else if (direction === 'check') {
  checkMigrations()
    .then((allApplied) => {
      process.exit(allApplied ? 0 : 1);
    })
    .catch((e) => {
      logger.error(e, 'Migration check failed');
      process.exit(1);
    });
} else {
  migrateUp().catch((e) => {
    logger.error(e, 'Migration UP failed');
    process.exit(1);
  });
}

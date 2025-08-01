import 'dotenv/config';

import assert from 'node:assert';

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

import logger from './services/logger';

interface Migration {
  id: string;
  up: string;
  down: string;
}

const databaseUrl = process.env.DATABASE_URL;
const filename = databaseUrl?.replace(/^file:\/\/\//, '') as string;

assert(!!filename, 'DATABASE_URL is required');

function loadMigrations(dir = 'migrations'): Migration[] {
  logger.info({ dir }, 'Загрузка миграций из директории');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();
  logger.info({ count: files.length }, 'Найдено файлов миграций');
  return files.map((upFile) => {
    const id = upFile.replace('.up.sql', '');
    const downFile = id + '.down.sql';
    logger.debug({ id, upFile, downFile }, 'Загрузка миграции');
    return {
      id,
      up: readFileSync(join(dir, upFile), 'utf8'),
      down: readFileSync(join(dir, downFile), 'utf8'),
    };
  });
}

async function getDb() {
  logger.info({ filename }, 'Подключение к базе данных');
  return open({ filename, driver: sqlite3.Database });
}

async function ensureTable(db: any) {
  logger.debug('Проверка существования таблицы migrations');
  await db.run(
    'CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT)'
  );
  logger.debug('Таблица migrations готова');
}

async function appliedMigrations(db: any): Promise<string[]> {
  logger.debug('Получение списка примененных миграций');
  const rows = (await db.all('SELECT id FROM migrations')) as { id: string }[];
  const applied = rows.map((r: { id: string }) => r.id);
  logger.info(
    { count: applied.length, applied },
    'Найдено примененных миграций'
  );
  return applied;
}

async function clearDatabase(db: any) {
  logger.info('Очистка базы данных');

  const tables = (await db.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  )) as { name: string }[];

  if (tables.length > 0) {
    logger.info(
      {
        count: tables.length,
        tables: tables.map((t: { name: string }) => t.name),
      },
      'Найдены таблицы для удаления'
    );

    for (const tableInfo of tables) {
      try {
        logger.debug({ table: tableInfo.name }, 'Удаление таблицы');
        await db.exec(`DROP TABLE IF EXISTS "${tableInfo.name}"`);
        logger.debug({ table: tableInfo.name }, 'Таблица удалена');
      } catch (error) {
        logger.warn(
          { table: tableInfo.name, error },
          'Не удалось удалить таблицу'
        );
      }
    }

    logger.info('Все таблицы удалены');
  } else {
    logger.debug('Таблиц для удаления не найдено');
  }
}

async function migrateUp() {
  logger.info('Начало процесса применения миграций (UP)');

  let db = await getDb();
  const table = await db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
  );
  logger.info({ table }, 'Проверка таблицы migrations');
  if (!table) {
    logger.info('Таблица migrations не найдена, очистка базы данных');
    await db.close();

    db = await getDb();
    await clearDatabase(db);
    await db.close();
    db = await getDb();
  } else {
    logger.debug('Таблица migrations найдена');
  }

  await ensureTable(db);
  const applied = await appliedMigrations(db);
  const migrations = loadMigrations();

  logger.info(
    { total: migrations.length, applied: applied.length },
    'Анализ миграций'
  );

  const pendingMigrations = migrations.filter((m) => !applied.includes(m.id));
  logger.info({ count: pendingMigrations.length }, 'Миграций для применения');

  for (const m of pendingMigrations) {
    logger.info({ id: m.id }, 'Применение миграции');
    try {
      await db.exec(m.up);
      await db.run(
        'INSERT INTO migrations (id, applied_at) VALUES (?, datetime("now"))',
        m.id
      );
      logger.info({ id: m.id }, 'Миграция успешно применена');
    } catch (error) {
      logger.error({ id: m.id, error }, 'Ошибка при применении миграции');
      throw error;
    }
  }

  logger.info('Все миграции успешно применены');
  await db.close();
}

async function migrateDown() {
  logger.info('Начало процесса отката миграций (DOWN)');

  const db = await getDb();
  await ensureTable(db);
  const applied = await appliedMigrations(db);

  if (applied.length === 0) {
    logger.info('Нет миграций для отката');
    await db.close();
    return;
  }

  const migrations = loadMigrations();
  const lastId = applied[applied.length - 1];
  const m = migrations.find((x) => x.id === lastId);

  if (!m) {
    logger.error({ id: lastId }, 'Файл миграции не найден');
    await db.close();
    return;
  }

  logger.info({ id: m.id }, 'Откат последней миграции');
  try {
    await db.exec(m.down);
    await db.run('DELETE FROM migrations WHERE id = ?', m.id);
    logger.info({ id: m.id }, 'Миграция успешно откачена');
  } catch (error) {
    logger.error({ id: m.id, error }, 'Ошибка при откате миграции');
    throw error;
  }

  await db.close();
}

const direction = process.argv[2];
logger.info({ direction }, 'Запуск миграций');

if (direction === 'down') {
  migrateDown().catch((e) => {
    logger.error(e, 'Миграция DOWN завершилась с ошибкой');
    process.exit(1);
  });
} else {
  migrateUp().catch((e) => {
    logger.error(e, 'Миграция UP завершилась с ошибкой');
    process.exit(1);
  });
}

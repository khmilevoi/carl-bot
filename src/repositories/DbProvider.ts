import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import type { Database } from 'sqlite';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

import type { Logger } from '../application/interfaces/logging/Logger.interface';
import {
  ENV_SERVICE_ID,
  EnvService,
} from '../application/use-cases/env/EnvService';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../application/use-cases/logging/LoggerFactory';
import { parseDatabaseUrl } from '../utils/database';

export interface DbProvider<T = unknown> {
  get(): Promise<T>;
  listTables(): Promise<string[]>;
}

export type SQLiteDbProvider = DbProvider<Database>;

@injectable()
export class SQLiteDbProviderImpl implements SQLiteDbProvider {
  private db: Promise<Database>;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.logger = loggerFactory.create('SQLiteDbProviderImpl');
    const filename = parseDatabaseUrl(envService.env.DATABASE_URL);
    this.logger.info({ filename }, 'Opening SQLite database');
    this.db = open({ filename, driver: sqlite3.Database }).catch((error) => {
      this.logger.error({ filename, error }, 'Failed to open SQLite database');
      throw error;
    });
  }

  get(): Promise<Database> {
    return this.db;
  }

  async listTables(): Promise<string[]> {
    try {
      const db = await this.db;
      const rows = await db.all<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      const tables = rows.map((r) => r.name);
      this.logger.info({ count: tables.length }, 'Enumerated database tables');
      return tables;
    } catch (error) {
      this.logger.error({ error }, 'Failed to list database tables');
      throw error;
    }
  }
}

export const DB_PROVIDER_ID = Symbol.for('DbProvider') as ServiceIdentifier<
  DbProvider<Database>
>;

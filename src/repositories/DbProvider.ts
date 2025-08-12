import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import type { Database } from 'sqlite';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

import { ENV_SERVICE_ID, EnvService } from '../services/env/EnvService';
import { parseDatabaseUrl } from '../utils/database';

export interface DbProvider<T = unknown> {
  get(): Promise<T>;
}

export interface SQLiteDbProvider extends DbProvider<Database> {
  listTables(): Promise<string[]>;
}

@injectable()
export class SQLiteDbProviderImpl implements SQLiteDbProvider {
  private db: Promise<Database>;

  constructor(@inject(ENV_SERVICE_ID) envService: EnvService) {
    const filename = parseDatabaseUrl(envService.env.DATABASE_URL);
    this.db = open({ filename, driver: sqlite3.Database });
  }

  get(): Promise<Database> {
    return this.db;
  }

  async listTables(): Promise<string[]> {
    const db = await this.db;
    const rows = await db.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return rows.map((r) => r.name);
  }
}

export const DB_PROVIDER_ID = Symbol.for(
  'DbProvider'
) as ServiceIdentifier<SQLiteDbProvider>;

import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

import { ENV_SERVICE_ID, EnvService } from '../services/env/EnvService';
import { parseDatabaseUrl } from '../utils/database';

@injectable()
export class DbProvider {
  private db: Promise<Database>;

  constructor(@inject(ENV_SERVICE_ID) envService: EnvService) {
    const filename = parseDatabaseUrl(envService.env.DATABASE_URL);
    this.db = open({ filename, driver: sqlite3.Database });
  }

  get(): Promise<Database> {
    return this.db;
  }
}

export const DB_PROVIDER_ID = Symbol.for(
  'DbProvider'
) as ServiceIdentifier<DbProvider>;

export default DbProvider;

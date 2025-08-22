import { inject, injectable } from 'inversify';

import {
  DB_PROVIDER_ID,
  type DbProvider,
  type SqlDatabase,
} from '@/domain/repositories/DbProvider.interface';

@injectable()
export abstract class BaseSQLiteRepository {
  constructor(
    @inject(DB_PROVIDER_ID) private readonly dbProvider: DbProvider
  ) {}

  protected db(): Promise<SqlDatabase> {
    return this.dbProvider.get();
  }
}

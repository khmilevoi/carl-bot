import { inject, injectable } from 'inversify';

import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider.interface';

@injectable()
export abstract class BaseSQLiteRepository {
  constructor(
    @inject(DB_PROVIDER_ID) protected readonly dbProvider: DbProvider
  ) {}
}

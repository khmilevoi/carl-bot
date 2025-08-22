import { inject, injectable } from 'inversify';

import type { UserEntity } from '@/domain/entities/UserEntity';
import {
  DB_PROVIDER_ID,
  type DbProvider,
} from '@/domain/repositories/DbProvider.interface';
import type { UserRepository } from '@/domain/repositories/UserRepository.interface';
import { BaseSQLiteRepository } from '@/infrastructure/persistence/sqlite/BaseSQLiteRepository';

@injectable()
export class SQLiteUserRepository
  extends BaseSQLiteRepository
  implements UserRepository
{
  constructor(@inject(DB_PROVIDER_ID) dbProvider: DbProvider) {
    super(dbProvider);
  }
  async upsert({
    id,
    username,
    firstName,
    lastName,
    attitude,
  }: UserEntity): Promise<void> {
    const db = await this.dbProvider.get();
    await db.run(
      'INSERT INTO users (id, username, first_name, last_name, attitude) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, last_name=excluded.last_name, attitude=excluded.attitude',
      id,
      username ?? null,
      firstName ?? null,
      lastName ?? null,
      attitude ?? null
    );
  }

  async findById(id: number): Promise<UserEntity | undefined> {
    const db = await this.dbProvider.get();
    const row = await db.get<{
      id: number;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      attitude: string | null;
    }>(
      'SELECT id, username, first_name, last_name, attitude FROM users WHERE id = ?',
      id
    );
    return row
      ? {
          id: row.id,
          username: row.username,
          firstName: row.first_name,
          lastName: row.last_name,
          attitude: row.attitude,
        }
      : undefined;
  }

  async setAttitude(userId: number, attitude: string): Promise<void> {
    const db = await this.dbProvider.get();
    await db.run(
      'UPDATE users SET attitude = ? WHERE id = ?',
      attitude,
      userId
    );
  }
}

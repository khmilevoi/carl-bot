import { inject, injectable } from 'inversify';

import { DB_PROVIDER_ID, type SQLiteDbProvider } from '../DbProvider';
import {
  type UserEntity,
  type UserRepository,
} from '../interfaces/UserRepository.interface';

@injectable()
export class SQLiteUserRepository implements UserRepository {
  constructor(@inject(DB_PROVIDER_ID) private dbProvider: SQLiteDbProvider) {}
  async upsert({
    id,
    username,
    firstName,
    lastName,
    attitude,
  }: UserEntity): Promise<void> {
    const db = await this.db();
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
    const db = await this.db();
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
    const db = await this.db();
    await db.run(
      'UPDATE users SET attitude = ? WHERE id = ?',
      attitude,
      userId
    );
  }

  private async db() {
    return this.dbProvider.get();
  }
}

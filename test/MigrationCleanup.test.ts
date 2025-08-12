import { readdirSync } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let migrateUp: () => Promise<void>;

class MockDb {
  migrations: string[] = [];
  hasMigrationsTable = false;

  async get(query: string) {
    if (query.includes('sqlite_master') && query.includes('migrations')) {
      return this.hasMigrationsTable ? { name: 'migrations' } : undefined;
    }
    return undefined;
  }

  async run(query: string, id?: string) {
    if (query.startsWith('CREATE TABLE')) {
      this.hasMigrationsTable = true;
    } else if (query.startsWith('INSERT INTO migrations')) {
      if (id) this.migrations.push(id);
      this.hasMigrationsTable = true;
    } else if (query.startsWith('DELETE FROM migrations')) {
      if (id)
        this.migrations = this.migrations.filter((existing) => existing !== id);
    }
  }

  async all(query: string) {
    if (query === 'SELECT id FROM migrations') {
      return this.migrations.map((id) => ({ id }));
    }
    return [];
  }

  async exec(_query: string) {}
  async close() {}
}

vi.mock('sqlite', () => ({
  open: vi.fn(async () => mockDb),
}));
vi.mock('sqlite3', () => ({
  default: { Database: class {} },
}));

let mockDb: MockDb;

async function loadMigrateModule() {
  const mod = await import('../src/migrate');
  migrateUp = mod.migrateUp;
}

describe('migrateUp', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockDb = new MockDb();
    process.env.DATABASE_URL = 'file://test.db';
    await loadMigrateModule();
    await migrateUp();
    mockDb.migrations.push('999_fake');
  });

  it('removes unknown migrations before applying new ones', async () => {
    await migrateUp();
    const ids = mockDb.migrations;
    expect(ids).not.toContain('999_fake');
    const migrationFiles = readdirSync('migrations').filter((f) =>
      f.endsWith('.up.sql')
    );
    expect(ids.length).toBe(migrationFiles.length);
  });
});

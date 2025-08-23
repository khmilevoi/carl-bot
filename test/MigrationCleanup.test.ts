import { readdirSync } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let migrateUp: () => Promise<void>;

class MockDb {
  migrations = new Set<string>();
  hasMigrationsTable = false;

  async get(query: string): Promise<{ name: string } | undefined> {
    if (query.includes('sqlite_master') && query.includes('migrations')) {
      return this.hasMigrationsTable ? { name: 'migrations' } : undefined;
    }
    return undefined;
  }

  async run(query: string, id?: string): Promise<void> {
    if (query.startsWith('CREATE TABLE')) {
      this.hasMigrationsTable = true;
    } else if (query.startsWith('INSERT INTO migrations')) {
      if (id) this.migrations.add(id);
      this.hasMigrationsTable = true;
    } else if (query.startsWith('DELETE FROM migrations')) {
      if (id) this.migrations.delete(id);
    }
  }

  async all(query: string): Promise<{ id: string }[]> {
    if (query === 'SELECT id FROM migrations') {
      return Array.from(this.migrations).map((id) => ({ id }));
    }
    return [];
  }

  async exec(_query: string): Promise<void> {}
  async close(): Promise<void> {}
}

vi.mock('sqlite', () => ({
  open: vi.fn(async () => mockDb),
}));
vi.mock('sqlite3', () => ({
  default: { Database: class {} },
}));

let mockDb: MockDb;

async function loadMigrateModule(): Promise<void> {
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
    mockDb.migrations.add('999_fake');
  });

  it('removes unknown migrations before applying new ones', async () => {
    await migrateUp();
    const ids = mockDb.migrations;
    expect(ids).not.toContain('999_fake');
    const migrationFiles = readdirSync('migrations').filter((f) =>
      f.endsWith('.up.sql')
    );
    expect(ids.size).toBe(migrationFiles.length);
  });
});

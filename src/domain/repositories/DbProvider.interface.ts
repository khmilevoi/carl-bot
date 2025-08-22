export interface SqlDatabase {
  run(sql: string, ...params: unknown[]): Promise<unknown>;
  get<T>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
}

export interface DbProvider {
  get(): Promise<SqlDatabase>;
  listTables(): Promise<string[]>;
}

export const DB_PROVIDER_ID = Symbol('DbProvider');

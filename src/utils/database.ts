export function parseDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  return databaseUrl.replace(/^file:\/\//, '');
}

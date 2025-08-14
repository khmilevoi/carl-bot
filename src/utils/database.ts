export function parseDatabaseUrl(databaseUrl: string | undefined): string {
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const trimmed = databaseUrl.trim();
  if (trimmed.startsWith('file://')) {
    return trimmed.replace(/^file:\/\//, '');
  }
  return trimmed;
}

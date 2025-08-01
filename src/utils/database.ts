/**
 * Парсит DATABASE_URL и извлекает путь к файлу базы данных
 * @param databaseUrl - URL базы данных в формате file:///path/to/database.db
 * @returns путь к файлу базы данных
 * @throws Error если DATABASE_URL не указан
 */
export function parseDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  return databaseUrl.replace(/^file:\/\//, '');
}

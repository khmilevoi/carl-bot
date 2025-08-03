import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { Init1710000000000 } from '@/migrations/1710000000000-Init';
import { AwaitingExport } from '@/services/storage/entities/AwaitingExport';
import { Message } from '@/services/storage/entities/Message';
import { Summary } from '@/services/storage/entities/Summary';
import { parseDatabaseUrl } from '@/utils/database';

export const DATA_SOURCE_ID = Symbol('DATA_SOURCE');

let dataSource: DataSource | null = null;

export function getDataSource(
  filename = parseDatabaseUrl(process.env.DATABASE_URL)
) {
  if (!dataSource) {
    dataSource = new DataSource({
      type: 'sqlite',
      database: filename,
      entities: [Message, Summary, AwaitingExport],
      migrations: [Init1710000000000],
      synchronize: false,
    });
  }
  if (!dataSource.isInitialized) {
    return dataSource.initialize();
  }
  return Promise.resolve(dataSource);
}

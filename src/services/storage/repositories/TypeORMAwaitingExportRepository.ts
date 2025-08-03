import { inject, injectable } from 'inversify';
import { DataSource, Repository } from 'typeorm';

import { DATA_SOURCE_ID } from '@/services/storage/dataSource';
import { AwaitingExport } from '@/services/storage/entities/AwaitingExport';

import { AwaitingExportRepository } from './AwaitingExportRepository';

@injectable()
export class TypeORMAwaitingExportRepository
  implements AwaitingExportRepository
{
  private repo: Promise<Repository<AwaitingExport>>;

  constructor(@inject(DATA_SOURCE_ID) dataSource: Promise<DataSource>) {
    this.repo = dataSource.then((ds) => ds.getRepository(AwaitingExport));
  }

  async add(chatId: number) {
    await (await this.repo).save({ chatId });
  }

  async exists(chatId: number) {
    const row = await (await this.repo).findOneBy({ chatId });
    return !!row;
  }

  async remove(chatId: number) {
    await (await this.repo).delete({ chatId });
  }
}

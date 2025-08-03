import { inject, injectable } from 'inversify';
import { DataSource, Repository } from 'typeorm';

import { DATA_SOURCE_ID } from '@/services/storage/dataSource';
import { Summary } from '@/services/storage/entities/Summary';

import { SummaryRepository } from './SummaryRepository';

@injectable()
export class TypeORMSummaryRepository implements SummaryRepository {
  private repo: Promise<Repository<Summary>>;

  constructor(@inject(DATA_SOURCE_ID) dataSource: Promise<DataSource>) {
    this.repo = dataSource.then((ds) => ds.getRepository(Summary));
  }

  findByChatId(chatId: number) {
    return this.repo.then((r) => r.findOneBy({ chatId }));
  }

  save(summary: Summary) {
    return this.repo.then((r) => r.save(summary));
  }
}

import { inject, injectable } from 'inversify';
import { DataSource, Repository } from 'typeorm';

import { DATA_SOURCE_ID } from '@/services/storage/dataSource';
import { Summary } from '@/services/storage/entities/Summary';

import { SummaryRepository } from './SummaryRepository';

@injectable()
export class TypeORMSummaryRepository implements SummaryRepository {
  private repo: Repository<Summary>;

  constructor(@inject(DATA_SOURCE_ID) dataSource: DataSource) {
    this.repo = dataSource.getRepository(Summary);
  }

  findByChatId(chatId: number) {
    return this.repo.findOneBy({ chatId });
  }

  save(summary: Summary) {
    return this.repo.save(summary);
  }
}

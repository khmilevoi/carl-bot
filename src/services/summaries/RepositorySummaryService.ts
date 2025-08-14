import { inject, injectable } from 'inversify';

import {
  SUMMARY_REPOSITORY_ID,
  type SummaryRepository,
} from '../../repositories/interfaces/SummaryRepository.interface';
import { logger } from '../logging/logger';
import { SummaryService } from './SummaryService.interface';

@injectable()
export class RepositorySummaryService implements SummaryService {
  constructor(
    @inject(SUMMARY_REPOSITORY_ID) private summaryRepo: SummaryRepository
  ) {}

  async getSummary(chatId: number) {
    logger.debug({ chatId }, 'Fetching summary');
    return this.summaryRepo.findById(chatId);
  }

  async setSummary(chatId: number, summary: string) {
    logger.debug({ chatId }, 'Storing summary');
    await this.summaryRepo.upsert(chatId, summary);
  }

  async clearSummary(chatId: number) {
    logger.debug({ chatId }, 'Clearing summary');
    await this.summaryRepo.clearByChatId(chatId);
  }
}

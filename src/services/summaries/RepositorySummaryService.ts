import { inject, injectable } from 'inversify';

import {
  SUMMARY_REPOSITORY_ID,
  type SummaryRepository,
} from '../../repositories/interfaces/SummaryRepository.interface';
import { PinoLogger } from '../logging/PinoLogger';
import { SummaryService } from './SummaryService.interface';

@injectable()
export class RepositorySummaryService implements SummaryService {
  private readonly logger = new PinoLogger();
  constructor(
    @inject(SUMMARY_REPOSITORY_ID) private summaryRepo: SummaryRepository
  ) {}

  async getSummary(chatId: number): Promise<string> {
    this.logger.debug({ chatId }, 'Fetching summary');
    return this.summaryRepo.findById(chatId);
  }

  async setSummary(chatId: number, summary: string): Promise<void> {
    this.logger.debug({ chatId }, 'Storing summary');
    await this.summaryRepo.upsert(chatId, summary);
  }

  async clearSummary(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Clearing summary');
    await this.summaryRepo.clearByChatId(chatId);
  }
}

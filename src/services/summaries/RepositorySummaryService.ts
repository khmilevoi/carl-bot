import { inject, injectable } from 'inversify';

import {
  SUMMARY_REPOSITORY_ID,
  type SummaryRepository,
} from '../../repositories/interfaces/SummaryRepository.interface';
import type Logger from '../logging/Logger.interface';
import {
  LOGGER_SERVICE_ID,
  type LoggerService,
} from '../logging/LoggerService';
import { SummaryService } from './SummaryService.interface';

@injectable()
export class RepositorySummaryService implements SummaryService {
  private readonly logger: Logger;
  constructor(
    @inject(SUMMARY_REPOSITORY_ID) private summaryRepo: SummaryRepository,
    @inject(LOGGER_SERVICE_ID) private loggerService: LoggerService
  ) {
    this.logger = this.loggerService.createLogger();
  }

  async getSummary(chatId: number): Promise<string> {
    this.logger.debug('Fetching summary', { chatId });
    return this.summaryRepo.findById(chatId);
  }

  async setSummary(chatId: number, summary: string): Promise<void> {
    this.logger.debug('Storing summary', { chatId });
    await this.summaryRepo.upsert(chatId, summary);
  }

  async clearSummary(chatId: number): Promise<void> {
    this.logger.debug('Clearing summary', { chatId });
    await this.summaryRepo.clearByChatId(chatId);
  }
}

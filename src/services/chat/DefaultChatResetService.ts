import { inject, injectable } from 'inversify';

import type Logger from '../logging/Logger.interface';
import {
  LOGGER_SERVICE_ID,
  type LoggerService,
} from '../logging/LoggerService';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from '../messages/MessageService.interface';
import {
  SUMMARY_SERVICE_ID,
  type SummaryService,
} from '../summaries/SummaryService.interface';
import { ChatResetService } from './ChatResetService.interface';

@injectable()
export class DefaultChatResetService implements ChatResetService {
  private readonly logger: Logger;
  constructor(
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(LOGGER_SERVICE_ID) private loggerService: LoggerService
  ) {
    this.logger = this.loggerService.createLogger();
  }

  async reset(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Resetting chat data');
    await this.messages.clearMessages(chatId);
    await this.summaries.clearSummary(chatId);
  }
}

import { inject, injectable } from 'inversify';

import type Logger from '../logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../logging/LoggerFactory';
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
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory
  ) {
    this.logger = this.loggerFactory.create('DefaultChatResetService');
  }

  async reset(chatId: number): Promise<void> {
    this.logger.debug({ chatId }, 'Resetting chat data');

    const [messageCount, summary] = await Promise.all([
      this.messages.getCount(chatId),
      this.summaries.getSummary(chatId),
    ]);

    await Promise.all([
      this.messages.clearMessages(chatId),
      this.summaries.clearSummary(chatId),
    ]);

    this.logger.info(
      {
        chatId,
        messagesCleared: messageCount,
        summariesCleared: summary ? 1 : 0,
      },
      'Cleared chat data'
    );
  }
}

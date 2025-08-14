import { inject, injectable } from 'inversify';

import { logger } from '../logging/logger';
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
  constructor(
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService
  ) {}

  async reset(chatId: number) {
    logger.debug({ chatId }, 'Resetting chat data');
    await this.messages.clearMessages(chatId);
    await this.summaries.clearSummary(chatId);
  }
}

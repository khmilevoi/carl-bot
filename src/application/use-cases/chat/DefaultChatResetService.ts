import { inject, injectable } from 'inversify';

import type { ChatResetService } from '@/application/interfaces/chat/ChatResetService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import {
  MESSAGE_SERVICE_ID,
  type MessageService,
} from '@/application/interfaces/messages/MessageService';
import {
  SUMMARY_SERVICE_ID,
  type SummaryService,
} from '@/application/interfaces/summaries/SummaryService';

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
    await this.messages.clearMessages(chatId);
    await this.summaries.clearSummary(chatId);
  }
}

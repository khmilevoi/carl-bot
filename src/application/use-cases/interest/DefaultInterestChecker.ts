import { inject, injectable } from 'inversify';

import type { ChatMessage } from '../../../domain/messages/ChatMessage.interface';
import {
  AI_SERVICE_ID,
  AIService,
} from '../../interfaces/ai/AIService.interface';
import {
  CHAT_CONFIG_SERVICE_ID,
  type ChatConfigService,
} from '../../interfaces/chat/ChatConfigService.interface';
import { type InterestChecker } from '../../interfaces/interest/InterestChecker.interface';
import type { Logger } from '../../interfaces/logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../../interfaces/logging/LoggerFactory.interface';
import {
  INTEREST_MESSAGE_STORE_ID,
  InterestMessageStore,
} from '../../interfaces/messages/InterestMessageStore.interface';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../../interfaces/summaries/SummaryService.interface';

@injectable()
export class DefaultInterestChecker implements InterestChecker {
  private readonly logger: Logger;

  constructor(
    @inject(INTEREST_MESSAGE_STORE_ID)
    private interestMessageStore: InterestMessageStore,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(AI_SERVICE_ID) private ai: AIService,
    @inject(CHAT_CONFIG_SERVICE_ID)
    private chatConfig: ChatConfigService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.logger = loggerFactory.create('InterestChecker');
  }

  async check(
    chatId: number
  ): Promise<{ messageId: string; message: string; why: string } | null> {
    const { interestInterval } = await this.chatConfig.getConfig(chatId);
    const count = this.interestMessageStore.getCount(chatId);
    this.logger.debug({ chatId, interestInterval, count }, 'Checking interest');
    if (count < interestInterval) {
      return null;
    }
    const history: ChatMessage[] = this.interestMessageStore.getLastMessages(
      chatId,
      interestInterval
    );
    this.interestMessageStore.clearMessages(chatId);
    const summary = (await this.summaries.getSummary(chatId)) ?? '';
    const result = await this.ai.checkInterest(history, summary);
    this.logger.debug(
      { chatId, result: result ? 'hit' : 'miss' },
      'AI interest check result'
    );
    if (!result) {
      return null;
    }
    const msg = history.find(
      (m) => m.messageId?.toString() === result.messageId
    );

    if (!msg) {
      return null;
    }

    return {
      message: msg.content,
      messageId: result.messageId,
      why: result.why,
    };
  }
}

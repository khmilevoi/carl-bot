import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';

import {
  USER_REPOSITORY_ID,
  UserRepository,
} from '../../repositories/interfaces/UserRepository.interface';
import {
  AI_SERVICE_ID,
  AIService,
  ChatMessage,
} from '../ai/AIService.interface';
import type Logger from '../logging/Logger.interface';
import {
  LOGGER_SERVICE_ID,
  type LoggerService,
} from '../logging/LoggerService';
import {
  MESSAGE_SERVICE_ID,
  MessageService,
} from '../messages/MessageService.interface';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../summaries/SummaryService.interface';

export interface HistorySummarizer {
  summarize(
    chatId: number,
    history: ChatMessage[],
    limit: number
  ): Promise<boolean>;
  assessUsers(chatId: number, history: ChatMessage[]): Promise<void>;
}

export const HISTORY_SUMMARIZER_ID = Symbol.for(
  'HistorySummarizer'
) as ServiceIdentifier<HistorySummarizer>;

@injectable()
export class DefaultHistorySummarizer implements HistorySummarizer {
  private readonly logger: Logger;
  constructor(
    @inject(AI_SERVICE_ID) private ai: AIService,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(USER_REPOSITORY_ID) private users: UserRepository,
    @inject(LOGGER_SERVICE_ID) private loggerService: LoggerService
  ) {
    this.logger = this.loggerService.createLogger();
  }

  async summarize(
    chatId: number,
    history: ChatMessage[],
    limit: number
  ): Promise<boolean> {
    this.logger.debug('Checking if summarization is needed', {
      chatId,
      historyLength: history.length,
      limit,
    });

    if (history.length <= limit) {
      this.logger.debug('No summarization needed', {
        chatId,
        historyLength: history.length,
        limit,
      });
      return false;
    }

    this.logger.debug('Summarizing chat history', {
      chatId,
      historyLength: history.length,
      limit,
    });
    const summary = await this.summaries.getSummary(chatId);
    this.logger.debug('Retrieved existing summary', {
      chatId,
      summaryLength: summary.length,
    });

    const newSummary = await this.ai.summarize(history, summary);
    this.logger.debug('Generated new summary', {
      chatId,
      newSummaryLength: newSummary.length,
    });

    await this.summaries.setSummary(chatId, newSummary);
    this.logger.debug('Stored new summary', { chatId });

    await this.messages.clearMessages(chatId);
    this.logger.debug('Cleared messages after summarization', { chatId });
    return true;
  }

  async assessUsers(chatId: number, history: ChatMessage[]): Promise<void> {
    this.logger.debug('Assessing user attitudes', {
      chatId,
      historyLength: history.length,
    });
    const prevAttitudes: { username: string; attitude: string }[] = [];
    const seen = new Set<number>();
    for (const m of history) {
      if (
        m.userId !== undefined &&
        m.role === 'user' &&
        m.username &&
        !seen.has(m.userId)
      ) {
        seen.add(m.userId);
        const user = await this.users.findById(m.userId);
        if (user?.attitude) {
          prevAttitudes.push({ username: m.username, attitude: user.attitude });
        }
      }
    }

    const assessments = await this.ai.assessUsers(history, prevAttitudes);
    this.logger.debug('Assessed user attitudes', {
      chatId,
      assessments: assessments.length,
    });

    for (const { username, attitude } of assessments) {
      const userMsg = history.find(
        (m) => m.username === username && m.userId !== undefined
      );
      if (userMsg?.userId !== undefined && attitude.trim() !== '') {
        await this.users.setAttitude(userMsg.userId, attitude);
      }
    }
  }
}

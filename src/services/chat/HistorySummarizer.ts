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
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../logging/LoggerFactory';
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
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory
  ) {
    this.logger = this.loggerFactory.create('DefaultHistorySummarizer');
  }

  async summarize(
    chatId: number,
    history: ChatMessage[],
    limit: number
  ): Promise<boolean> {
    this.logger.debug(
      {
        chatId,
        historyLength: history.length,
        limit,
      },
      'Checking if summarization is needed'
    );

    if (history.length <= limit) {
      this.logger.debug(
        {
          chatId,
          historyLength: history.length,
          limit,
        },
        'No summarization needed'
      );
      return false;
    }

    this.logger.debug(
      {
        chatId,
        historyLength: history.length,
        limit,
      },
      'Summarizing chat history'
    );
    const summary = await this.summaries.getSummary(chatId);
    this.logger.debug(
      {
        chatId,
        summaryLength: summary.length,
      },
      'Retrieved existing summary'
    );

    const newSummary = await this.ai.summarize(history, summary);
    this.logger.debug(
      {
        chatId,
        newSummaryLength: newSummary.length,
      },
      'Generated new summary'
    );

    await this.summaries.setSummary(chatId, newSummary);
    this.logger.debug({ chatId }, 'Stored new summary');

    await this.messages.clearMessages(chatId);
    this.logger.debug({ chatId }, 'Cleared messages after summarization');
    return true;
  }

  async assessUsers(chatId: number, history: ChatMessage[]): Promise<void> {
    this.logger.debug(
      {
        chatId,
        historyLength: history.length,
      },
      'Assessing user attitudes'
    );
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
    this.logger.debug(
      {
        chatId,
        assessments: assessments.length,
      },
      'Assessed user attitudes'
    );

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

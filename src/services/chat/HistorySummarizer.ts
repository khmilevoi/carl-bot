import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';

import { AI_SERVICE_ID, AIService, ChatMessage } from '../ai/AIService';
import { logger } from '../logging/logger';
import { MESSAGE_SERVICE_ID, MessageService } from '../messages/MessageService';
import {
  SUMMARY_SERVICE_ID,
  SummaryService,
} from '../summaries/SummaryService';

export interface HistorySummarizer {
  summarizeIfNeeded(
    chatId: number,
    history: ChatMessage[],
    limit: number
  ): Promise<void>;
}

export const HISTORY_SUMMARIZER_ID = Symbol.for(
  'HistorySummarizer'
) as ServiceIdentifier<HistorySummarizer>;

@injectable()
export class DefaultHistorySummarizer implements HistorySummarizer {
  constructor(
    @inject(AI_SERVICE_ID) private ai: AIService,
    @inject(SUMMARY_SERVICE_ID) private summaries: SummaryService,
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService
  ) {}

  async summarizeIfNeeded(
    chatId: number,
    history: ChatMessage[],
    limit: number
  ): Promise<void> {
    logger.debug(
      { chatId, historyLength: history.length, limit },
      'Checking if summarization is needed'
    );

    if (history.length <= limit) {
      logger.debug(
        { chatId, historyLength: history.length, limit },
        'No summarization needed'
      );
      return;
    }

    logger.debug(
      { chatId, historyLength: history.length, limit },
      'Summarizing chat history'
    );
    const summary = await this.summaries.getSummary(chatId);
    logger.debug(
      { chatId, summaryLength: summary.length },
      'Retrieved existing summary'
    );

    const newSummary = await this.ai.summarize(history, summary);
    logger.debug(
      { chatId, newSummaryLength: newSummary.length },
      'Generated new summary'
    );

    await this.summaries.setSummary(chatId, newSummary);
    logger.debug({ chatId }, 'Stored new summary');

    await this.messages.clearMessages(chatId);
    logger.debug({ chatId }, 'Cleared messages after summarization');
  }
}

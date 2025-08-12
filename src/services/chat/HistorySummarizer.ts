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
    if (history.length <= limit) return;
    logger.debug({ chatId }, 'Summarizing chat history');
    const summary = await this.summaries.getSummary(chatId);
    const newSummary = await this.ai.summarize(history, summary);
    await this.summaries.setSummary(chatId, newSummary);
    await this.messages.clearMessages(chatId);
  }
}

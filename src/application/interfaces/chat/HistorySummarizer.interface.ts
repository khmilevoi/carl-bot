import type { ServiceIdentifier } from 'inversify';

import type { ChatMessage } from '../ai/AIService.interface';

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

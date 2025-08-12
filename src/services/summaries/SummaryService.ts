import type { ServiceIdentifier } from 'inversify';

export interface SummaryService {
  getSummary(chatId: number): Promise<string>;
  setSummary(chatId: number, summary: string): Promise<void>;
  clearSummary(chatId: number): Promise<void>;
}

export const SUMMARY_SERVICE_ID = Symbol.for(
  'SummaryService'
) as ServiceIdentifier<SummaryService>;

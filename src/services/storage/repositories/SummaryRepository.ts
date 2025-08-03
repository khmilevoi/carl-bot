import { Summary } from '@/services/storage/entities/Summary';

export const SUMMARY_REPOSITORY_ID = Symbol('SummaryRepository');

export interface SummaryRepository {
  findByChatId(chatId: number): Promise<Summary | null>;
  save(summary: Summary): Promise<Summary>;
}

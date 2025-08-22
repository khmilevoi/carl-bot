export interface SummaryRepository {
  upsert(chatId: number, summary: string): Promise<void>;
  findById(chatId: number): Promise<string>;
  clearByChatId(chatId: number): Promise<void>;
}

export const SUMMARY_REPOSITORY_ID = Symbol('SummaryRepository');

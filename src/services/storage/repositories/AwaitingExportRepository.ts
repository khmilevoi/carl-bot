export const AWAITING_EXPORT_REPOSITORY_ID = Symbol('AwaitingExportRepository');

export interface AwaitingExportRepository {
  add(chatId: number): Promise<void>;
  exists(chatId: number): Promise<boolean>;
  remove(chatId: number): Promise<void>;
}

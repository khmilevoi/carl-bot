export type ChatStatus = 'pending' | 'approved' | 'banned';

export interface ChatAccessEntity {
  chatId: number;
  status: ChatStatus;
  requestedAt?: number;
  approvedAt?: number;
}

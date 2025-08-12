import type { ServiceIdentifier } from 'inversify';

export interface ChatResetService {
  reset(chatId: number): Promise<void>;
}

export const CHAT_RESET_SERVICE_ID = Symbol.for(
  'ChatResetService'
) as ServiceIdentifier<ChatResetService>;

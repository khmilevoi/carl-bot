import type { ServiceIdentifier } from 'inversify';

export interface BotService {
  sendMessage(chatId: number, text: string): Promise<void>;
}

export const BOT_SERVICE_ID = Symbol.for(
  'BotService'
) as ServiceIdentifier<BotService>;

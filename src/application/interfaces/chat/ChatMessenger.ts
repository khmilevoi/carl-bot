import type { ServiceIdentifier } from 'inversify';
import type { Telegraf } from 'telegraf';

export interface ChatMessenger {
  readonly bot: Telegraf;
  sendMessage(chatId: number, text: string, extra?: object): Promise<void>;
  launch(): Promise<void>;
  stop(reason: string): void;
}

export const CHAT_MESSENGER_ID = Symbol.for(
  'ChatMessenger'
) as ServiceIdentifier<ChatMessenger>;

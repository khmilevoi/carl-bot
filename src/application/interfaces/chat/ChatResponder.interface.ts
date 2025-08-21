import type { ServiceIdentifier } from 'inversify';
import type { Context } from 'telegraf';

import type { TriggerReason } from '../../../triggers/Trigger.interface';

export interface ChatResponder {
  generate(
    ctx: Context,
    chatId: number,
    triggerReason?: TriggerReason
  ): Promise<string>;
}

export const CHAT_RESPONDER_ID = Symbol.for(
  'ChatResponder'
) as ServiceIdentifier<ChatResponder>;

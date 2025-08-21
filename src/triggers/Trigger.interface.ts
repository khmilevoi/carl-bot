import type { Context } from 'telegraf';

import type { DialogueManager } from '../application/interfaces/chat/DialogueManager.interface';

export interface TriggerContext {
  text: string;
  replyText: string;
  chatId: number;
}

export interface TriggerReason {
  message: string;
  why: string;
}

export interface TriggerResult {
  replyToMessageId: number | null;
  reason: TriggerReason | null;
}

export interface Trigger {
  apply(
    ctx: Context,
    context: TriggerContext,
    dialogue: DialogueManager
  ): Promise<TriggerResult | null>;
}

import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';

export interface TriggerContext {
  text: string;
  replyText: string;
  chatId: number;
}

export interface TriggerResult {
  replyToMessageId: number | null;
  reason: string | null;
}

export interface Trigger {
  apply(
    ctx: Context,
    context: TriggerContext,
    dialogue: DialogueManager
  ): Promise<TriggerResult | null>;
}

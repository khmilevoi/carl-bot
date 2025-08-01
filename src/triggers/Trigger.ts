import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';

export interface TriggerContext {
  text: string;
  replyText: string;
  chatId: number;
}

export interface Trigger {
  apply(
    ctx: Context,
    context: TriggerContext,
    dialogue: DialogueManager
  ): boolean;
}

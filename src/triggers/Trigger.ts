import { Context } from 'telegraf';
import { DialogueManager } from '../services/DialogueManager';

export interface TriggerContext {
  text: string;
  replyText: string;
  chatId: number;
}

export interface Trigger {
  matches(ctx: Context): boolean;
  apply(ctx: Context, context: TriggerContext, dialogue: DialogueManager): boolean;
}

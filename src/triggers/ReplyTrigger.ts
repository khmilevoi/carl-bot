import { Context } from 'telegraf';
import { Trigger, TriggerContext } from './Trigger';
import { DialogueManager } from '../services/DialogueManager';

export class ReplyTrigger implements Trigger {
  matches(ctx: Context): boolean {
    return (
      (ctx.message as any)?.reply_to_message?.from?.username === ctx.me
    );
  }

  apply(ctx: Context, context: TriggerContext, dialogue: DialogueManager): boolean {
    const reply = (ctx.message as any)?.reply_to_message;
    if (reply?.from?.username === ctx.me) {
      dialogue.start(context.chatId);
      return true;
    }
    return false;
  }
}

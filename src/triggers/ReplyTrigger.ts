import { Context } from 'telegraf';
import { Trigger, TriggerContext } from './Trigger';
import { DialogueManager } from '../services/DialogueManager';

export class ReplyTrigger implements Trigger {
  apply(ctx: Context, context: TriggerContext, dialogue: DialogueManager): boolean {
    const reply = (ctx.message as any)?.reply_to_message;
    if (reply && typeof reply.text === 'string') {
      context.replyText = reply.text;
    }
    if (reply?.from?.username === ctx.me) {
      dialogue.start(context.chatId);
      return true;
    }
    return false;
  }
}

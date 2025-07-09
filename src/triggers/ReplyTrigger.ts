import { Context } from 'telegraf';

import { DialogueManager } from '../services/DialogueManager';
import { Trigger, TriggerContext } from './Trigger';

export class ReplyTrigger implements Trigger {
  apply(
    ctx: Context,
    context: TriggerContext,
    dialogue: DialogueManager
  ): boolean {
    const reply = (ctx.message as any)?.reply_to_message;

    if (reply?.from?.username === ctx.me) {
      return true;
    }
    return false;
  }
}

import { Context } from 'telegraf';
import { Trigger, TriggerContext } from './Trigger';
import { DialogueManager } from '../services/DialogueManager';

export class MentionTrigger implements Trigger {
  apply(ctx: Context, context: TriggerContext, dialogue: DialogueManager): boolean {
    const text = (ctx.message as any)?.text ?? '';
    if (text.includes(`@${ctx.me}`)) {
      context.text = text.replace(`@${(ctx as any).me}`, '').trim();
      return true;
    }
    return false;
  }
}

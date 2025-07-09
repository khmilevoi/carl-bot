import { Context } from 'telegraf';
import { Trigger, TriggerContext } from './Trigger';
import { DialogueManager } from '../services/DialogueManager';

export class MentionTrigger implements Trigger {
  matches(ctx: Context): boolean {
    const text = (ctx.message as any)?.text ?? '';
    return text.includes(`@${ctx.me}`);
  }
  apply(ctx: Context, context: TriggerContext, dialogue: DialogueManager): boolean {
    const text = (ctx.message as any)?.text ?? '';
    if (text.includes(`@${ctx.me}`)) {
      context.text = text.replace(`@${(ctx as any).me}`, '').trim();
      dialogue.start(context.chatId);
      return true;
    }
    return false;
  }
}

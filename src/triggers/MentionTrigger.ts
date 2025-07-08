import { Context } from 'telegraf';
import { Trigger } from './Trigger';

export class MentionTrigger implements Trigger {
  matches(ctx: Context): boolean {
    const text = (ctx.message as any)?.text ?? '';
    return text.includes(`@${ctx.me}`);
  }
}

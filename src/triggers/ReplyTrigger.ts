import { Context } from 'telegraf';
import { Trigger } from './Trigger';

export class ReplyTrigger implements Trigger {
  matches(ctx: Context): boolean {
    return (
      (ctx.message as any)?.reply_to_message?.from?.username === ctx.me
    );
  }
}

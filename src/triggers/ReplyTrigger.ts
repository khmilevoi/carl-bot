import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';
import { logger } from '../services/logging/logger';
import { Trigger, TriggerContext } from './Trigger';

export class ReplyTrigger implements Trigger {
  apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    const reply = (ctx.message as any)?.reply_to_message;

    if (reply?.from?.username === ctx.me) {
      logger.debug({ chatId: context.chatId }, 'Reply trigger matched');
      return true;
    }
    return false;
  }
}

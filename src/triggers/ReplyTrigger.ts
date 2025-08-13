import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';
import { logger } from '../services/logging/logger';
import { Trigger, TriggerContext, TriggerResult } from './Trigger';

export class ReplyTrigger implements Trigger {
  async apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const reply = (ctx.message as any)?.reply_to_message;

    if (reply?.from?.username === ctx.me) {
      logger.debug({ chatId: context.chatId }, 'Reply trigger matched');
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}

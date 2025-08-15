import type { Context } from 'telegraf';

import type { DialogueManager } from '../services/chat/DialogueManager';
import { logger } from '../services/logging/logger';
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from './Trigger.interface';

export class ReplyTrigger implements Trigger {
  async apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const msg = ctx.message as
      | { reply_to_message?: { from?: { username?: string } } }
      | undefined;
    const reply = msg?.reply_to_message;

    if (reply?.from?.username === ctx.me) {
      logger.debug({ chatId: context.chatId }, 'Reply trigger matched');
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}

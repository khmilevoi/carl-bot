import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';
import { logger } from '../services/logging/logger';
import { Trigger, TriggerContext, TriggerResult } from './Trigger';

export class MentionTrigger implements Trigger {
  async apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const text = (ctx.message as any)?.text ?? '';
    if (text.includes(`@${ctx.me}`)) {
      context.text = text.replace(`@${(ctx as any).me}`, '').trim();
      logger.debug({ chatId: context.chatId }, 'Mention trigger matched');
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}

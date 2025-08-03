import { Context } from 'telegraf';

import { DialogueManager } from '@/services/chat/DialogueManager';
import logger from '@/services/logging/logger';
import { Trigger, TriggerContext } from '@/triggers/Trigger';

export class MentionTrigger implements Trigger {
  apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): boolean {
    const text = (ctx.message as any)?.text ?? '';
    if (text.includes(`@${ctx.me}`)) {
      context.text = text.replace(`@${(ctx as any).me}`, '').trim();
      logger.debug({ chatId: context.chatId }, 'Mention trigger matched');
      return true;
    }
    return false;
  }
}

import type { Context } from 'telegraf';

import type { DialogueManager } from '../services/chat/DialogueManager';
import { PinoLogger } from '../services/logging/PinoLogger';
const logger = new PinoLogger();
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from './Trigger.interface';

export class MentionTrigger implements Trigger {
  async apply(
    ctx: Context,
    context: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const msg = ctx.message as Record<string, unknown> | undefined;
    const text = typeof msg?.text === 'string' ? msg.text : '';
    const me =
      typeof (ctx as unknown as Record<string, unknown>).me === 'string'
        ? (ctx as unknown as { me: string }).me
        : '';
    if (text.includes(`@${me}`)) {
      context.text = text.replace(`@${me}`, '').trim();
      logger.debug({ chatId: context.chatId }, 'Mention trigger matched');
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}

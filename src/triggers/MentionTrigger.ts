import type { Context } from 'telegraf';

import type { DialogueManager } from '../services/chat/DialogueManager';
import type Logger from '../services/logging/Logger.interface';
import { type LoggerFactory } from '../services/logging/LoggerFactory';
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from './Trigger.interface';

export class MentionTrigger implements Trigger {
  private readonly logger: Logger;
  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('MentionTrigger');
  }
  async apply(
    ctx: Context,
    context: TriggerContext,
    dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const msg = ctx.message as Record<string, unknown> | undefined;
    const text = typeof msg?.text === 'string' ? msg.text : '';
    const me =
      typeof (ctx as unknown as Record<string, unknown>).me === 'string'
        ? (ctx as unknown as { me: string }).me
        : '';
    const mention = `@${me}`;
    const index = text.indexOf(mention);
    if (index !== -1) {
      const snippet = text.slice(
        Math.max(0, index - 20),
        Math.min(text.length, index + mention.length + 20)
      );
      context.text = text.replace(mention, '').trim();
      const dialogueState = dialogue.isActive(context.chatId)
        ? 'active'
        : 'inactive';
      this.logger.debug(
        { chatId: context.chatId, snippet, dialogueState },
        'Mention trigger matched'
      );
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}

import { inject, injectable } from 'inversify';
import type { Context } from 'telegraf';

import type { DialogueManager } from '../application/interfaces/chat/DialogueManager.interface';
import type { Logger } from '../application/interfaces/logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../application/interfaces/logging/LoggerFactory.interface';
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from '../domain/triggers/Trigger.interface';

@injectable()
export class MentionTrigger implements Trigger {
  private readonly logger: Logger;
  constructor(@inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory) {
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

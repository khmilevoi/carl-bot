import type { Context } from 'telegraf';

import type { DialogueManager } from '../services/chat/DialogueManager';
import type Logger from '../services/logging/Logger.interface';
import { type LoggerFactory } from '../services/logging/LoggerFactory';
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from './Trigger.interface';

export class ReplyTrigger implements Trigger {
  private readonly logger: Logger;
  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('ReplyTrigger');
  }
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
      this.logger.debug({ chatId: context.chatId }, 'Reply trigger matched');
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}

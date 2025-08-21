import type { Context } from 'telegraf';

import type { DialogueManager } from '../application/interfaces/chat/DialogueManager.interface';
import type { Logger } from '../application/interfaces/logging/Logger.interface';
import { type LoggerFactory } from '../application/interfaces/logging/LoggerFactory.interface';
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
      | {
          message_id?: number;
          reply_to_message?: { from?: { username?: string } };
        }
      | undefined;
    const reply = msg?.reply_to_message;

    if (reply?.from?.username === ctx.me) {
      this.logger.debug(
        {
          chatId: context.chatId,
          messageId: msg?.message_id,
          username: ctx.from?.username,
        },
        'Reply trigger matched'
      );
      return { replyToMessageId: null, reason: null };
    }
    return null;
  }
}

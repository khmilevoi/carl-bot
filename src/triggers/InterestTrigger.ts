import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';
import { InterestChecker } from '../services/interest/InterestChecker';
import { logger } from '../services/logging/logger';
import { Trigger, TriggerContext, TriggerResult } from './Trigger.interface';

export class InterestTrigger implements Trigger {
  constructor(private checker: InterestChecker) {}

  async apply(
    _ctx: Context,
    { chatId }: TriggerContext,
    dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    if (dialogue.isActive(chatId)) {
      return null;
    }

    const result = await this.checker.check(chatId);
    if (result) {
      logger.debug({ chatId }, 'Interest trigger matched');
      return {
        replyToMessageId: result.messageId ? Number(result.messageId) : null,
        reason: { message: result.message, why: result.why },
      };
    }
    return null;
  }
}

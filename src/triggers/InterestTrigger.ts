import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';
import { InterestChecker } from '../services/interest/InterestChecker';
import { logger } from '../services/logging/logger';
import { Trigger, TriggerContext, TriggerResult } from './Trigger';

export class InterestTrigger implements Trigger {
  constructor(private checker: InterestChecker) {}

  async apply(
    _ctx: Context,
    { chatId }: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    const result = await this.checker.check(chatId);
    if (result) {
      logger.debug({ chatId }, 'Interest trigger matched');
      return {
        replyToMessageId: result.messageId ? Number(result.messageId) : null,
        reason: result.why,
      };
    }
    return null;
  }
}

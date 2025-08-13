import { Context } from 'telegraf';

import { DialogueManager } from '../services/chat/DialogueManager';
import { InterestChecker } from '../services/interest/InterestChecker';
import { logger } from '../services/logging/logger';
import { Trigger, TriggerContext } from './Trigger';

export class InterestTrigger implements Trigger {
  constructor(private checker: InterestChecker) {}

  async apply(
    _ctx: Context,
    { chatId }: TriggerContext,
    _dialogue: DialogueManager
  ): Promise<boolean> {
    const result = await this.checker.check(chatId);
    if (result?.interested) {
      logger.debug({ chatId }, 'Interest trigger matched');
      return true;
    }
    return false;
  }
}

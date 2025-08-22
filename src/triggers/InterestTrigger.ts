import type { Context } from 'telegraf';

import type { DialogueManager } from '../application/interfaces/chat/DialogueManager.interface';
import type { InterestChecker } from '../application/interfaces/interest/InterestChecker.interface';
import type { Logger } from '../application/interfaces/logging/Logger.interface';
import { type LoggerFactory } from '../application/interfaces/logging/LoggerFactory.interface';
import type {
  Trigger,
  TriggerContext,
  TriggerResult,
} from '../domain/triggers/Trigger.interface';

export class InterestTrigger implements Trigger {
  private readonly logger: Logger;
  constructor(
    private checker: InterestChecker,
    loggerFactory: LoggerFactory
  ) {
    this.logger = loggerFactory.create('InterestTrigger');
  }

  async apply(
    _ctx: Context,
    { chatId }: TriggerContext,
    dialogue: DialogueManager
  ): Promise<TriggerResult | null> {
    if (dialogue.isActive(chatId)) {
      this.logger.debug(
        { chatId },
        'Interest trigger suppressed because dialogue is active'
      );
      return null;
    }

    const result = await this.checker.check(chatId);
    if (result) {
      this.logger.debug({ chatId }, 'Interest trigger matched');
      return {
        replyToMessageId: result.messageId ? Number(result.messageId) : null,
        reason: { message: result.message, why: result.why },
      };
    }
    this.logger.debug(
      { chatId },
      'Interest trigger suppressed because interest check returned null'
    );
    return null;
  }
}

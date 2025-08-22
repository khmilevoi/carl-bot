import { inject, injectable, multiInject } from 'inversify';
import type { Context } from 'telegraf';

import type {
  TriggerContext,
  TriggerResult,
} from '../../../domain/triggers/Trigger.interface';
import {
  type Trigger,
  TRIGGER_ID,
} from '../../../domain/triggers/Trigger.interface';
import {
  DIALOGUE_MANAGER_ID,
  type DialogueManager,
} from '../../interfaces/chat/DialogueManager.interface';
import { type TriggerPipeline } from '../../interfaces/chat/TriggerPipeline.interface';
import type { Logger } from '../../interfaces/logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../../interfaces/logging/LoggerFactory.interface';

@injectable()
export class DefaultTriggerPipeline implements TriggerPipeline {
  private readonly logger: Logger;

  constructor(
    @inject(DIALOGUE_MANAGER_ID) private dialogue: DialogueManager,
    @multiInject(TRIGGER_ID) private triggers: Trigger<Context>[],
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.logger = loggerFactory.create('DefaultTriggerPipeline');
  }

  async shouldRespond(
    ctx: Context,
    context: TriggerContext
  ): Promise<TriggerResult | null> {
    const chatId = context.chatId;
    const inDialogue = this.dialogue.isActive(chatId);
    let matchedTrigger: string | null = null;
    let result: TriggerResult | null = null;

    for (const trigger of this.triggers) {
      result = await trigger.apply(ctx, context);
      if (result) {
        matchedTrigger = trigger.constructor.name;
        break;
      }
    }

    const matched = matchedTrigger !== null;
    if (matched) {
      if (inDialogue) {
        this.dialogue.extend(chatId);
      } else {
        this.dialogue.start(chatId);
      }
      this.logger.debug({ chatId, trigger: matchedTrigger }, 'Trigger matched');
    } else {
      this.logger.debug({ chatId }, 'No trigger matched');
    }

    return result;
  }
}

import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import {
  INTEREST_TRIGGER_ID,
  MENTION_TRIGGER_ID,
  NAME_TRIGGER_ID,
  REPLY_TRIGGER_ID,
  Trigger,
  TriggerContext,
  TriggerResult,
} from '../../../triggers/Trigger.interface';
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
  private mentionTrigger: Trigger;
  private replyTrigger: Trigger;
  private nameTrigger: Trigger;
  private interestTrigger: Trigger;
  private readonly logger: Logger;

  constructor(
    @inject(DIALOGUE_MANAGER_ID) private dialogue: DialogueManager,
    @inject(MENTION_TRIGGER_ID) mentionTrigger: Trigger,
    @inject(REPLY_TRIGGER_ID) replyTrigger: Trigger,
    @inject(NAME_TRIGGER_ID) nameTrigger: Trigger,
    @inject(INTEREST_TRIGGER_ID) interestTrigger: Trigger,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.logger = loggerFactory.create('DefaultTriggerPipeline');
    this.nameTrigger = nameTrigger;
    this.interestTrigger = interestTrigger;
    this.mentionTrigger = mentionTrigger;
    this.replyTrigger = replyTrigger;
  }

  async shouldRespond(
    ctx: Context,
    context: TriggerContext
  ): Promise<TriggerResult | null> {
    const chatId = context.chatId;
    const inDialogue = this.dialogue.isActive(chatId);
    let matchedTrigger: string | null = null;
    let result: TriggerResult | null = await this.mentionTrigger.apply(
      ctx,
      context,
      this.dialogue
    );
    if (result) {
      matchedTrigger = 'MentionTrigger';
    } else {
      result = await this.replyTrigger.apply(ctx, context, this.dialogue);
      if (result) {
        matchedTrigger = 'ReplyTrigger';
      } else {
        result = await this.nameTrigger.apply(ctx, context, this.dialogue);
        if (result) {
          matchedTrigger = 'NameTrigger';
        } else {
          result = await this.interestTrigger.apply(
            ctx,
            context,
            this.dialogue
          );
          if (result) {
            matchedTrigger = 'InterestTrigger';
          }
        }
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

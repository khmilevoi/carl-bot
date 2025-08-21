import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import { InterestTrigger } from '../../triggers/InterestTrigger';
import { MentionTrigger } from '../../triggers/MentionTrigger';
import { NameTrigger } from '../../triggers/NameTrigger';
import { ReplyTrigger } from '../../triggers/ReplyTrigger';
import {
  TriggerContext,
  TriggerResult,
} from '../../triggers/Trigger.interface';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import {
  INTEREST_CHECKER_ID,
  InterestChecker,
} from '../interest/InterestChecker';
import type { Logger } from '../logging/Logger.interface';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '../logging/LoggerFactory';
import { DIALOGUE_MANAGER_ID, type DialogueManager } from './DialogueManager';

export interface TriggerPipeline {
  shouldRespond(
    ctx: Context,
    context: TriggerContext
  ): Promise<TriggerResult | null>;
}

export const TRIGGER_PIPELINE_ID = Symbol.for(
  'TriggerPipeline'
) as ServiceIdentifier<TriggerPipeline>;

@injectable()
export class DefaultTriggerPipeline implements TriggerPipeline {
  private mentionTrigger: MentionTrigger;
  private replyTrigger: ReplyTrigger;
  private nameTrigger: NameTrigger;
  private interestTrigger: InterestTrigger;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(INTEREST_CHECKER_ID) interestChecker: InterestChecker,
    @inject(DIALOGUE_MANAGER_ID) private dialogue: DialogueManager,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    this.logger = loggerFactory.create('DefaultTriggerPipeline');
    this.nameTrigger = new NameTrigger(envService.getBotName(), loggerFactory);
    this.interestTrigger = new InterestTrigger(interestChecker, loggerFactory);
    this.mentionTrigger = new MentionTrigger(loggerFactory);
    this.replyTrigger = new ReplyTrigger(loggerFactory);
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

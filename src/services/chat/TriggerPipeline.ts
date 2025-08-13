import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import { InterestTrigger } from '../../triggers/InterestTrigger';
import { MentionTrigger } from '../../triggers/MentionTrigger';
import { NameTrigger } from '../../triggers/NameTrigger';
import { ReplyTrigger } from '../../triggers/ReplyTrigger';
import { TriggerContext, TriggerResult } from '../../triggers/Trigger';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import {
  INTEREST_CHECKER_ID,
  InterestChecker,
} from '../interest/InterestChecker';
import { DialogueManager } from './DialogueManager';

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
  private dialogue: DialogueManager;
  private mentionTrigger = new MentionTrigger();
  private replyTrigger = new ReplyTrigger();
  private nameTrigger: NameTrigger;
  private interestTrigger: InterestTrigger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(INTEREST_CHECKER_ID) interestChecker: InterestChecker
  ) {
    this.dialogue = new DialogueManager(envService.getDialogueTimeoutMs());
    this.nameTrigger = new NameTrigger(envService.getBotName());
    this.interestTrigger = new InterestTrigger(interestChecker);
  }

  async shouldRespond(
    ctx: Context,
    context: TriggerContext
  ): Promise<TriggerResult | null> {
    const chatId = context.chatId;
    const inDialogue = this.dialogue.isActive(chatId);
    let result: TriggerResult | null = null;
    result =
      (await this.mentionTrigger.apply(ctx, context, this.dialogue)) ?? result;
    result =
      (await this.replyTrigger.apply(ctx, context, this.dialogue)) ?? result;
    result =
      (await this.nameTrigger.apply(ctx, context, this.dialogue)) ?? result;

    if (!result) {
      result = await this.interestTrigger.apply(ctx, context, this.dialogue);
    }

    const matched = !!result;
    if (matched && !inDialogue) {
      this.dialogue.start(chatId);
    } else if (!matched && inDialogue) {
      this.dialogue.extend(chatId);
    }

    return result;
  }
}

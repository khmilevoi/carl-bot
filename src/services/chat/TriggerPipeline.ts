import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import { Context } from 'telegraf';

import { MentionTrigger } from '../../triggers/MentionTrigger';
import { NameTrigger } from '../../triggers/NameTrigger';
import { ReplyTrigger } from '../../triggers/ReplyTrigger';
import { StemDictTrigger } from '../../triggers/StemDictTrigger';
import { TriggerContext } from '../../triggers/Trigger';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { DialogueManager } from './DialogueManager';

export interface TriggerPipeline {
  shouldRespond(ctx: Context, context: TriggerContext): boolean;
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
  private keywordTrigger: StemDictTrigger;

  constructor(@inject(ENV_SERVICE_ID) envService: EnvService) {
    this.dialogue = new DialogueManager(envService.getDialogueTimeoutMs());
    this.nameTrigger = new NameTrigger(envService.getBotName());
    this.keywordTrigger = new StemDictTrigger(envService.getKeywordsFile());
  }

  shouldRespond(ctx: Context, context: TriggerContext): boolean {
    const chatId = context.chatId;
    const inDialogue = this.dialogue.isActive(chatId);
    let matched = false;
    matched = this.mentionTrigger.apply(ctx, context, this.dialogue) || matched;
    matched = this.replyTrigger.apply(ctx, context, this.dialogue) || matched;
    matched = this.nameTrigger.apply(ctx, context, this.dialogue) || matched;

    if (matched && !inDialogue) {
      this.dialogue.start(chatId);
    } else if (!matched && inDialogue) {
      this.dialogue.extend(chatId);
    }

    if (!matched) {
      if (
        !this.keywordTrigger.apply(ctx, context, this.dialogue) ||
        inDialogue
      ) {
        return false;
      }
    }

    return true;
  }
}

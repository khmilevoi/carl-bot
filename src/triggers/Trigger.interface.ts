import type { ServiceIdentifier } from 'inversify';
import type { Context } from 'telegraf';

import type { DialogueManager } from '../application/interfaces/chat/DialogueManager.interface';

export interface TriggerContext {
  text: string;
  replyText: string;
  chatId: number;
}

export interface TriggerReason {
  message: string;
  why: string;
}

export interface TriggerResult {
  replyToMessageId: number | null;
  reason: TriggerReason | null;
}

export interface Trigger {
  apply(
    ctx: Context,
    context: TriggerContext,
    dialogue: DialogueManager
  ): Promise<TriggerResult | null>;
}

export const MENTION_TRIGGER_ID = Symbol.for(
  'MentionTrigger'
) as ServiceIdentifier<Trigger>;
export const REPLY_TRIGGER_ID = Symbol.for(
  'ReplyTrigger'
) as ServiceIdentifier<Trigger>;
export const NAME_TRIGGER_ID = Symbol.for(
  'NameTrigger'
) as ServiceIdentifier<Trigger>;
export const INTEREST_TRIGGER_ID = Symbol.for(
  'InterestTrigger'
) as ServiceIdentifier<Trigger>;

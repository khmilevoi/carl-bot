import type { ServiceIdentifier } from 'inversify';
import type { Context } from 'telegraf';

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
  apply(ctx: Context, context: TriggerContext): Promise<TriggerResult | null>;
}

export const TRIGGER_ID = Symbol.for('Trigger') as ServiceIdentifier<Trigger>;

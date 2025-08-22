import type { ServiceIdentifier } from 'inversify';
import type { Context } from 'telegraf';

export interface MessageContext {
  replyText?: string;
  replyUsername?: string;
  quoteText?: string;
  username: string;
  fullName: string;
}

export interface MessageContextExtractor {
  extract(ctx: Context): MessageContext;
}

export const MESSAGE_CONTEXT_EXTRACTOR_ID = Symbol.for(
  'MessageContextExtractor'
) as ServiceIdentifier<MessageContextExtractor>;

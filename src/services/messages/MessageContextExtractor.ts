import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';
import { Context } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';

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

@injectable()
export class DefaultMessageContextExtractor implements MessageContextExtractor {
  extract(ctx: Context): MessageContext {
    type MessageWithQuote = Message & {
      reply_to_message?: Record<string, unknown>;
      quote?: { text?: string };
    };

    const message = ctx.message as MessageWithQuote | undefined;

    let replyText: string | undefined;
    let replyUsername: string | undefined;
    let quoteText: string | undefined;

    if (message?.reply_to_message) {
      const pieces: string[] = [];
      const reply = message.reply_to_message as Record<string, unknown>;
      if (typeof reply.text === 'string') {
        pieces.push(reply.text);
      }
      if (typeof reply.caption === 'string') {
        pieces.push(reply.caption);
      }
      if (pieces.length > 0) {
        replyText = pieces.join('; ');
      }

      const from = message.reply_to_message.from as
        | { first_name?: string; last_name?: string; username?: string }
        | undefined;
      if (from) {
        if (from.first_name && from.last_name) {
          replyUsername = from.first_name + ' ' + from.last_name;
        } else {
          replyUsername = from.first_name || from.username || undefined;
        }
      }
    }

    if (message?.quote && typeof message.quote.text === 'string') {
      quoteText = message.quote.text;
    }

    const username = ctx.from?.username || 'Имя неизвестно';
    const fullName =
      ctx.from?.first_name && ctx.from?.last_name
        ? ctx.from.first_name + ' ' + ctx.from.last_name
        : ctx.from?.first_name || ctx.from?.last_name || username;

    return { replyText, replyUsername, quoteText, username, fullName };
  }
}

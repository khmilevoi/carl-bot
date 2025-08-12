import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';
import { Context } from 'telegraf';

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
    const message: any = ctx.message;

    let replyText: string | undefined;
    let replyUsername: string | undefined;
    let quoteText: string | undefined;

    if (message?.reply_to_message) {
      const pieces: string[] = [];
      if (typeof message.reply_to_message.text === 'string') {
        pieces.push(message.reply_to_message.text);
      }
      if (typeof message.reply_to_message.caption === 'string') {
        pieces.push(message.reply_to_message.caption);
      }
      if (pieces.length > 0) {
        replyText = pieces.join('; ');
      }

      const from = message.reply_to_message.from;
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

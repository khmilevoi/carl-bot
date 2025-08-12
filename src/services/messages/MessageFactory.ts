import assert from 'node:assert';

import { Context } from 'telegraf';

import { StoredMessage } from './StoredMessage';

export class MessageFactory {
  static fromUser(ctx: Context): StoredMessage {
    const message = ctx.message as any;
    assert(message && typeof message.text === 'string', 'Нет текста сообщения');

    let replyText: string | undefined;
    let replyUsername: string | undefined;
    let quoteText: string | undefined;
    if (message.reply_to_message) {
      const pieces: string[] = [];
      if (typeof message.reply_to_message.text === 'string') {
        pieces.push(message.reply_to_message.text);
      }
      if (typeof message.reply_to_message.caption === 'string') {
        pieces.push(message.reply_to_message.caption);
      }
      assert(pieces.length > 0, 'Нет текста или подписи в reply_to_message');
      replyText = pieces.join('; ');

      const from = message.reply_to_message.from;
      if (from) {
        if (from.first_name && from.last_name) {
          replyUsername = from.first_name + ' ' + from.last_name;
        } else {
          replyUsername = from.first_name || from.username || undefined;
        }
      }
    }

    if (message.quote && typeof message.quote.text === 'string') {
      quoteText = message.quote.text;
    }

    const username = ctx.from?.username || 'Имя неизвестно';
    const fullName =
      ctx.from?.first_name && ctx.from?.last_name
        ? ctx.from.first_name + ' ' + ctx.from.last_name
        : ctx.from?.first_name || ctx.from?.last_name || username;

    return {
      role: 'user',
      content: message.text,
      username,
      fullName,
      replyText,
      replyUsername,
      quoteText,
      userId: ctx.from?.id,
      messageId: ctx.message?.message_id,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      chatId: ctx.chat!.id,
      chatTitle: (ctx.chat as any)?.title,
    };
  }

  static fromAssistant(ctx: Context, content: string): StoredMessage {
    return {
      role: 'assistant',
      content,
      username: ctx.me,
      chatId: ctx.chat!.id,
      chatTitle: (ctx.chat as any)?.title,
    };
  }
}

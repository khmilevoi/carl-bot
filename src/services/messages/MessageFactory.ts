import assert from 'node:assert';

import { Context } from 'telegraf';

import { MessageContext } from './MessageContextExtractor';
import { StoredMessage } from './StoredMessage';

export class MessageFactory {
  static fromUser(ctx: Context, meta: MessageContext): StoredMessage {
    const message = ctx.message as any;
    assert(message && typeof message.text === 'string', 'Нет текста сообщения');

    const { replyText, replyUsername, quoteText, username, fullName } = meta;

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

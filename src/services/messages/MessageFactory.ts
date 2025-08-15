import assert from 'node:assert';

import type { Context } from 'telegraf';

import type { MessageContext } from './MessageContextExtractor';
import type { StoredMessage } from './StoredMessage.interface';

export class MessageFactory {
  static fromUser(ctx: Context, meta: MessageContext): StoredMessage {
    const msg = ctx.message as { text?: string } | undefined;
    const text = msg?.text;
    assert(typeof text === 'string', 'Нет текста сообщения');

    const { replyText, replyUsername, quoteText, username, fullName } = meta;

    const chatId = ctx.chat?.id;
    assert(chatId !== undefined, 'No chat id');
    const chatTitle =
      ctx.chat !== undefined && 'title' in ctx.chat
        ? ctx.chat.title
        : undefined;

    return {
      role: 'user',
      content: text,
      username,
      fullName,
      replyText,
      replyUsername,
      quoteText,
      userId: ctx.from?.id,
      messageId: ctx.message?.message_id,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      chatId,
      chatTitle,
    };
  }

  static fromAssistant(ctx: Context, content: string): StoredMessage {
    const chatId = ctx.chat?.id;
    assert(chatId !== undefined, 'No chat id');
    const chatTitle =
      ctx.chat !== undefined && 'title' in ctx.chat
        ? ctx.chat.title
        : undefined;

    return {
      role: 'assistant',
      content,
      username: ctx.me,
      chatId,
      chatTitle,
    };
  }
}

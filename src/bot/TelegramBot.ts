import assert from 'node:assert';

import { injectable } from 'inversify';
import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { AIService } from '../services/ai/AIService';
import { ChatFilter } from '../services/chat/ChatFilter';
import { ChatMemoryManager } from '../services/chat/ChatMemory';
import { DialogueManager } from '../services/chat/DialogueManager';
import logger from '../services/logging/logger';
import { MentionTrigger } from '../triggers/MentionTrigger';
import { NameTrigger } from '../triggers/NameTrigger';
import { ReplyTrigger } from '../triggers/ReplyTrigger';
import { StemDictTrigger } from '../triggers/StemDictTrigger';
import { TriggerContext } from '../triggers/Trigger';

// Хелпер-обёртка: показывает "typing…" всё время работы колбэка
async function withTyping(ctx: Context, fn: () => Promise<void>) {
  // запускаем индикатор сразу
  await ctx.sendChatAction('typing');

  // каждые 4 с шлём ещё один, пока задача не кончится
  const timer = setInterval(() => {
    ctx.telegram.sendChatAction(ctx.chat!.id, 'typing').catch(() => {});
  }, 4000);

  try {
    await fn(); // ваша долгая логика — запрос к БД, API и т.д.
  } finally {
    clearInterval(timer); // убираем таймер даже при ошибке
  }
}

@injectable()
export class TelegramBot {
  private bot: Telegraf;
  private dialogue = new DialogueManager(60 * 1000);
  private mentionTrigger = new MentionTrigger();
  private replyTrigger = new ReplyTrigger();
  private nameTrigger = new NameTrigger('Карл');
  private keywordTrigger = new StemDictTrigger('keywords.json');

  constructor(
    token: string,
    private ai: AIService,
    private memories: ChatMemoryManager,
    private filter: ChatFilter
  ) {
    this.bot = new Telegraf(token);
    this.configure();
  }

  private configure() {
    this.bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

    this.bot.command('reset', async (ctx) => {
      await this.memories.reset(ctx.chat.id);
      ctx.reply('Контекст диалога сброшен!');
    });

    this.bot.command('ping', (ctx) => ctx.reply('pong'));

    // this.bot.on('message', (ctx) => {
    //   logger.debug(
    //     { message: ctx.message, chatId: ctx.chat?.id },
    //     'Получено сообщение'
    //   );
    // });

    this.bot.on(message('text'), (ctx) => this.handleText(ctx));
  }

  private async handleText(ctx: Context) {
    const chatId = ctx.chat?.id;
    assert(!!chatId, 'This is not a chat');
    logger.debug({ chatId }, 'Received text message');

    if (!this.filter.isAllowed(chatId)) {
      logger.warn({ chatId }, 'Попытка доступа из неразрешённого чата');
      ctx.reply('Этот чат не находится в списке разрешённых.');
      return;
    }

    const message = ctx.message as any;
    assert(message && typeof message.text === 'string', 'Нет текста сообщения');

    let replyText: string | undefined;
    let replyUsername: string | undefined;
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

    const context: TriggerContext = {
      text: `${message.text};`,
      replyText: replyText ?? '',
      chatId,
    };

    const inDialogue = this.dialogue.isActive(chatId);
    logger.debug({ chatId, inDialogue }, 'Checking triggers');

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
        logger.debug({ chatId }, 'No trigger matched');
        return;
      }
    }

    await withTyping(ctx, async () => {
      logger.debug({ chatId }, 'Generating answer');

      const memory = this.memories.get(chatId);

      const username = ctx.from?.username || 'Имя неизвестно';
      const fullName =
        ctx.from?.first_name && ctx.from?.last_name
          ? ctx.from.first_name + ' ' + ctx.from.last_name
          : ctx.from?.first_name || ctx.from?.last_name || username;

      await memory.addMessage(
        'user',
        message.text,
        username,
        fullName,
        replyText,
        replyUsername
      );

      const answer = await this.ai.ask(
        await memory.getHistory(),
        await memory.getSummary()
      );
      logger.debug({ chatId }, 'Answer generated');
      await memory.addMessage('assistant', answer, ctx.me);

      ctx.reply(answer, {
        reply_parameters: ctx.message?.message_id
          ? { message_id: ctx.message?.message_id }
          : undefined,
      });
      logger.debug({ chatId }, 'Reply sent');
    });
  }

  public async launch() {
    logger.info('Launching bot');
    if (process.env.NODE_ENV === 'production') {
      assert(process.env.DOMAIN, 'Environment variable DOMAIN is not set');
      assert(process.env.PORT, 'Environment variable PORT is not set');
      await this.bot.launch({
        webhook: {
          domain: process.env.DOMAIN,
          port: Number(process.env.PORT),
        },
      });
    } else {
      await this.bot.launch();
    }
    logger.info('Bot launched');
  }

  public stop(reason: string) {
    logger.info({ reason }, 'Stopping bot');
    this.bot.stop(reason);
  }
}

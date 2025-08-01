import assert from 'node:assert';

import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { AIService } from '../services/AIService';
import { ChatFilter } from '../services/ChatFilter';
import { ChatMemoryManager } from '../services/ChatMemory';
import { DialogueManager } from '../services/DialogueManager';
import logger from '../services/logger';
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

    let replyText = '';
    if (message.reply_to_message) {
      assert(
        typeof message.reply_to_message.text === 'string' ||
          typeof message.reply_to_message.caption === 'string',
        'Нет текста или подписи в reply_to_message'
      );
      replyText = `Пользователь ответил на: ${message.reply_to_message.text}; ${message.reply_to_message.caption}`;
    }

    const context: TriggerContext = {
      text: `${message.text};`,
      replyText,
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

      let userPrompt = '';
      if (context.replyText) {
        userPrompt += `"${context.replyText}";`;
      }
      userPrompt += `Сообщение пользователя: "${context.text}";`;

      await memory.addMessage('user', userPrompt, ctx.from?.username);

      const answer = await this.ai.ask(
        await memory.getHistory(),
        await memory.getSummary()
      );
      logger.debug({ chatId }, 'Answer generated');
      await memory.addMessage('assistant', answer, ctx.me);

      ctx.reply(answer, {
        reply_parameters: { message_id: (ctx.message as any).message_id },
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

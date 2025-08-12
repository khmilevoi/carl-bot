import assert from 'node:assert';

import { injectable } from 'inversify';
import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { AdminService } from '../services/admin/AdminService';
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

async function withTyping(ctx: Context, fn: () => Promise<void>) {
  await ctx.sendChatAction('typing');

  const timer = setInterval(() => {
    ctx.telegram.sendChatAction(ctx.chat!.id, 'typing').catch(() => {});
  }, 4000);

  try {
    await fn();
  } finally {
    clearInterval(timer);
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
    private filter: ChatFilter,
    private admin: AdminService
  ) {
    this.bot = new Telegraf(token);
    this.configure();
  }

  private configure() {
    this.bot.start((ctx) => ctx.reply('Привет! Я Карл.'));

    this.bot.command('reset', async (ctx) => {
      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      assert(chatId, 'This is not a chat');
      assert(userId, 'No user id');
      const allowed = await this.admin.hasAccess(chatId, userId);
      if (!allowed) {
        ctx.reply('Нет доступа или ключ просрочен');
        return;
      }
      await this.memories.reset(chatId);
      ctx.reply('Контекст диалога сброшен!');
    });

    this.bot.command('ping', (ctx) => ctx.reply('pong'));

    this.bot.command('getkey', async (ctx) => {
      const adminChatId = Number(process.env.ADMIN_CHAT_ID);
      assert(
        !Number.isNaN(adminChatId),
        'Environment variable ADMIN_CHAT_ID is not set'
      );
      const userId = ctx.from?.id;
      assert(userId, 'No user id');
      const approveCmd = `/approve ${ctx.chat!.id} ${userId}`;
      const msg = [
        `Chat ${ctx.chat!.id} user ${userId} requests access. Approve with:`,
        '`',
        approveCmd,
        '`',
      ].join('\n');
      await ctx.telegram.sendMessage(adminChatId, msg, {
        parse_mode: 'Markdown',
      });
      ctx.reply('Запрос отправлен администратору.');
    });

    this.bot.command('approve', async (ctx) => {
      const adminChatId = Number(process.env.ADMIN_CHAT_ID);
      if (ctx.chat?.id !== adminChatId) return;
      const parts = ctx.message?.text.split(' ') ?? [];
      const targetChat = Number(parts[1]);
      const targetUser = Number(parts[2]);
      if (!targetChat || !targetUser) {
        ctx.reply('Укажите ID чата и ID пользователя');
        return;
      }
      const expiresAt = await this.admin.createAccessKey(
        targetChat,
        targetUser
      );
      await ctx.telegram.sendMessage(
        targetChat,
        `Доступ к данным разрешен для пользователя ${targetUser} до ${expiresAt.toISOString()}. Используйте /export и /reset`
      );
      ctx.reply(`Одобрено для чата ${targetChat} и пользователя ${targetUser}`);
    });

    this.bot.command('export', async (ctx) => {
      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      assert(chatId, 'This is not a chat');
      assert(userId, 'No user id');
      const allowed = await this.admin.hasAccess(chatId, userId);
      if (!allowed) {
        ctx.reply('Нет доступа или ключ просрочен');
        return;
      }
      const files = await this.admin.exportTables();
      for (const f of files) {
        await ctx.replyWithDocument({ source: f.buffer, filename: f.filename });
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    });

    this.bot.telegram
      .setMyCommands([
        { command: 'start', description: 'Приветствие' },
        {
          command: 'reset',
          description: 'Сбросить память диалога (нужен доступ)',
        },
        { command: 'ping', description: 'Ответ pong' },
        { command: 'getkey', description: 'Запросить доступ к данным' },
        {
          command: 'export',
          description: 'Выгрузить данные в CSV (нужен доступ)',
        },
        { command: 'approve', description: 'Одобрить доступ к данным (админ)' },
      ])
      .catch((err) => logger.error({ err }, 'Failed to set bot commands'));

    this.bot.on(message('text'), (ctx) => this.handleText(ctx));
  }

  private async handleText(ctx: Context) {
    const chatId = ctx.chat?.id;
    assert(!!chatId, 'This is not a chat');
    logger.debug({ chatId }, 'Received text message');

    if (!this.filter.isAllowed(chatId)) {
      logger.warn({ chatId }, 'Unauthorized chat access attempt');
      ctx.reply('Этот чат не находится в списке разрешённых.');
      return;
    }

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
        replyUsername,
        quoteText
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

import assert from 'node:assert';

import { inject, injectable } from 'inversify';
import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { ADMIN_SERVICE_ID, AdminService } from '../services/admin/AdminService';
import { CHAT_FILTER_ID, ChatFilter } from '../services/chat/ChatFilter';
import { ChatMemoryManager } from '../services/chat/ChatMemory';
import {
  CHAT_RESPONDER_ID,
  ChatResponder,
} from '../services/chat/ChatResponder';
import {
  TRIGGER_PIPELINE_ID,
  TriggerPipeline,
} from '../services/chat/TriggerPipeline';
import { Env, ENV_SERVICE_ID, EnvService } from '../services/env/EnvService';
import { logger } from '../services/logging/logger';
import {
  MESSAGE_CONTEXT_EXTRACTOR_ID,
  MessageContextExtractor,
} from '../services/messages/MessageContextExtractor';
import { MessageFactory } from '../services/messages/MessageFactory';
import {
  MESSAGE_SERVICE_ID,
  MessageService,
} from '../services/messages/MessageService';
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
  private env: Env;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(ChatMemoryManager) private memories: ChatMemoryManager,
    @inject(CHAT_FILTER_ID) private filter: ChatFilter,
    @inject(ADMIN_SERVICE_ID) private admin: AdminService,
    @inject(MESSAGE_SERVICE_ID) private messages: MessageService,
    @inject(MESSAGE_CONTEXT_EXTRACTOR_ID)
    private extractor: MessageContextExtractor,
    @inject(TRIGGER_PIPELINE_ID) private pipeline: TriggerPipeline,
    @inject(CHAT_RESPONDER_ID) private responder: ChatResponder
  ) {
    this.env = envService.env;
    this.bot = new Telegraf(this.env.BOT_TOKEN);
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
      const adminChatId = this.env.ADMIN_CHAT_ID;
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
      const adminChatId = this.env.ADMIN_CHAT_ID;
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
      if (files.length === 0) {
        ctx.reply('Нет данных для экспорта');
        return;
      }
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

    const meta = this.extractor.extract(ctx);
    const userMsg = MessageFactory.fromUser(ctx, meta);
    await this.messages.addMessage(userMsg);

    const context: TriggerContext = {
      text: `${userMsg.content};`,
      replyText: userMsg.replyText ?? '',
      chatId,
    };

    logger.debug({ chatId }, 'Checking triggers');
    const shouldRespond = this.pipeline.shouldRespond(ctx, context);
    if (!shouldRespond) {
      logger.debug({ chatId }, 'No trigger matched');
      return;
    }

    await withTyping(ctx, async () => {
      logger.debug({ chatId }, 'Generating answer');
      const answer = await this.responder.generate(ctx, chatId);
      logger.debug({ chatId }, 'Answer generated');

      ctx.reply(answer, {
        reply_parameters: userMsg.messageId
          ? { message_id: userMsg.messageId }
          : undefined,
      });
      logger.debug({ chatId }, 'Reply sent');
    });
  }

  public async launch() {
    logger.info('Launching bot');
    if (this.env.NODE_ENV === 'production') {
      await this.bot.launch({
        webhook: {
          domain: this.env.DOMAIN!,
          port: this.env.PORT!,
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

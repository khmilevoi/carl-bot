import assert from 'node:assert';

import { inject, injectable } from 'inversify';
import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { ADMIN_SERVICE_ID, AdminService } from '../services/admin/AdminService';
import {
  CHAT_APPROVAL_SERVICE_ID,
  ChatApprovalService,
} from '../services/chat/ChatApprovalService';
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
    @inject(ADMIN_SERVICE_ID) private admin: AdminService,
    @inject(CHAT_APPROVAL_SERVICE_ID)
    private approvalService: ChatApprovalService,
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

    this.bot.command('ban_chat', async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) return;
      const parts = ctx.message?.text.split(' ') ?? [];
      const targetChat = Number(parts[1]);
      if (!targetChat) {
        ctx.reply('Укажите ID чата');
        return;
      }
      await this.approvalService.ban(targetChat);
      await ctx.reply(`Чат ${targetChat} забанен`);
      await ctx.telegram.sendMessage(targetChat, 'Доступ запрещён');
    });

    this.bot.command('unban_chat', async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) return;
      const parts = ctx.message?.text.split(' ') ?? [];
      const targetChat = Number(parts[1]);
      if (!targetChat) {
        ctx.reply('Укажите ID чата');
        return;
      }
      await this.approvalService.unban(targetChat);
      await ctx.reply(`Чат ${targetChat} разбанен`);
      await ctx.telegram.sendMessage(targetChat, 'Доступ разрешён');
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

    // Добавляем команду для запроса загрузки данных через кнопки
    this.bot.command('request_export', async (ctx) => {
      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      assert(chatId, 'This is not a chat');
      assert(userId, 'No user id');

      // Проверяем, есть ли уже доступ
      const allowed = await this.admin.hasAccess(chatId, userId);
      if (allowed) {
        // Если доступ есть, сразу показываем кнопку для экспорта
        await ctx.reply('У вас есть доступ к данным. Выберите действие:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Загрузить данные', callback_data: 'export_data' }],
            ],
          },
        });
      } else {
        // Если доступа нет, показываем кнопку для запроса доступа
        await ctx.reply(
          'Для загрузки данных нужен доступ. Выберите действие:',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🔑 Запросить доступ',
                    callback_data: 'chat_request',
                  },
                ],
              ],
            },
          }
        );
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
        {
          command: 'request_export',
          description: 'Запросить загрузку данных через кнопки',
        },
        { command: 'approve', description: 'Одобрить доступ к данным (админ)' },
        { command: 'ban_chat', description: 'Забанить чат (админ)' },
        { command: 'unban_chat', description: 'Разбанить чат (админ)' },
      ])
      .catch((err) => logger.error({ err }, 'Failed to set bot commands'));

    this.bot.on('my_chat_member', async (ctx) => {
      const chatId = ctx.chat?.id;
      assert(chatId, 'This is not a chat');
      logger.info({ chatId }, 'Bot added to chat');
      const status = await this.approvalService.getStatus(chatId);
      if (status !== 'approved') {
        logger.info(
          { chatId, status },
          'Chat not approved, showing request access button'
        );
        await ctx.reply('Этот чат не находится в списке разрешённых.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Запросить доступ', callback_data: 'chat_request' }],
            ],
          },
        });
      } else {
        logger.info({ chatId, status }, 'Chat already approved');
        // Показываем кнопки для работы с данными, если чат уже одобрен
        await ctx.reply(
          'Добро пожаловать! У вас есть доступ к данным. Выберите действие:',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 Загрузить данные', callback_data: 'export_data' }],
                [{ text: '🔄 Сбросить память', callback_data: 'reset_memory' }],
              ],
            },
          }
        );
      }
    });

    this.bot.action('chat_request', async (ctx) => {
      const chatId = ctx.chat?.id;
      assert(chatId, 'This is not a chat');
      const title = 'title' in ctx.chat! ? (ctx.chat as any).title : undefined;
      logger.info({ chatId, title }, 'Chat access request received');
      await this.sendChatApprovalRequest(chatId, title);

      await ctx.answerCbQuery();
      await ctx.reply('Запрос отправлен');
      logger.info({ chatId }, 'Chat access request sent to admin');
    });

    // Обработчик для кнопки загрузки данных
    this.bot.action('export_data', async (ctx) => {
      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      assert(chatId, 'This is not a chat');
      assert(userId, 'No user id');

      const allowed = await this.admin.hasAccess(chatId, userId);
      if (!allowed) {
        await ctx.answerCbQuery('Нет доступа или ключ просрочен');
        return;
      }

      await ctx.answerCbQuery('Начинаю загрузку данных...');

      try {
        const files = await this.admin.exportTables();
        if (files.length === 0) {
          await ctx.reply('Нет данных для экспорта');
          return;
        }

        await ctx.reply(
          `Найдено ${files.length} таблиц для экспорта. Начинаю загрузку...`
        );

        for (const f of files) {
          await ctx.replyWithDocument({
            source: f.buffer,
            filename: f.filename,
          });
          await new Promise<void>((resolve) => setImmediate(resolve));
        }

        await ctx.reply('✅ Загрузка данных завершена!');
      } catch (error) {
        logger.error({ error, chatId }, 'Failed to export data');
        await ctx.reply('❌ Ошибка при загрузке данных. Попробуйте позже.');
      }
    });

    // Обработчик для кнопки сброса памяти
    this.bot.action('reset_memory', async (ctx) => {
      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      assert(chatId, 'This is not a chat');
      assert(userId, 'No user id');

      const allowed = await this.admin.hasAccess(chatId, userId);
      if (!allowed) {
        await ctx.answerCbQuery('Нет доступа или ключ просрочен');
        return;
      }

      await ctx.answerCbQuery('Сбрасываю память диалога...');

      try {
        await this.memories.reset(chatId);
        await ctx.reply('✅ Контекст диалога сброшен!');
      } catch (error) {
        logger.error({ error, chatId }, 'Failed to reset memory');
        await ctx.reply('❌ Ошибка при сбросе памяти. Попробуйте позже.');
      }
    });

    this.bot.action(/^chat_approve:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        logger.warn(
          { adminChatId, requestChatId: ctx.chat?.id },
          'Unauthorized chat approval attempt'
        );
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      logger.info({ chatId, adminChatId }, 'Approving chat access');
      await this.approvalService.approve(chatId);
      await ctx.answerCbQuery('Чат одобрен');
      await ctx.telegram.sendMessage(chatId, 'Доступ разрешён');
      logger.info({ chatId }, 'Chat access approved successfully');
    });

    this.bot.action(/^chat_ban:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        logger.warn(
          { adminChatId, requestChatId: ctx.chat?.id },
          'Unauthorized chat ban attempt'
        );
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      logger.info({ chatId, adminChatId }, 'Banning chat access');
      await this.approvalService.ban(chatId);
      await ctx.answerCbQuery('Чат забанен');
      await ctx.telegram.sendMessage(chatId, 'Доступ запрещён');
      logger.info({ chatId }, 'Chat access banned successfully');
    });

    this.bot.on(message('text'), (ctx) => this.handleText(ctx));
  }

  private async handleText(ctx: Context) {
    const chatId = ctx.chat?.id;
    assert(!!chatId, 'This is not a chat');
    logger.debug({ chatId }, 'Received text message');

    const status = await this.approvalService.getStatus(chatId);
    if (status === 'pending') {
      const title = 'title' in ctx.chat! ? (ctx.chat as any).title : undefined;
      await this.sendChatApprovalRequest(chatId, title);

      return;
    }

    if (status === 'banned') {
      logger.warn({ chatId }, 'Message from banned chat ignored');
      return;
    }

    // Если чат одобрен, проверяем доступ пользователя и показываем кнопки
    if (status === 'approved') {
      const userId = ctx.from?.id;
      if (userId) {
        const hasAccess = await this.admin.hasAccess(chatId, userId);
        if (hasAccess) {
          // Показываем кнопки для работы с данными
          await ctx.reply('Выберите действие:', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 Загрузить данные', callback_data: 'export_data' }],
                [{ text: '🔄 Сбросить память', callback_data: 'reset_memory' }],
              ],
            },
          });
        }
      }
    }

    const meta = this.extractor.extract(ctx);
    const userMsg = MessageFactory.fromUser(ctx, meta);
    await this.memories.get(chatId).addMessage(userMsg);

    const context: TriggerContext = {
      text: `${userMsg.content};`,
      replyText: userMsg.replyText ?? '',
      chatId,
    };

    logger.debug({ chatId }, 'Checking triggers');
    const triggerResult = await this.pipeline.shouldRespond(ctx, context);
    if (!triggerResult) {
      logger.debug({ chatId }, 'No trigger matched');
      return;
    }

    await withTyping(ctx, async () => {
      logger.debug({ chatId }, 'Generating answer');
      const answer = await this.responder.generate(
        ctx,
        chatId,
        triggerResult.reason ?? undefined
      );
      logger.debug({ chatId }, 'Answer generated');

      const replyId = triggerResult.replyToMessageId ?? userMsg.messageId;
      ctx.reply(answer, {
        reply_parameters: replyId ? { message_id: replyId } : undefined,
      });
      logger.debug({ chatId }, 'Reply sent');
    });
  }

  public async launch() {
    logger.info('Launching bot');
    await this.bot.telegram
      .deleteWebhook()
      .catch((err) =>
        logger.warn({ err }, 'Failed to delete existing webhook')
      );
    await this.bot.launch();
    logger.info('Bot launched');
  }

  public stop(reason: string) {
    logger.info({ reason }, 'Stopping bot');
    this.bot.stop(reason);
  }

  public async sendChatApprovalRequest(
    chatId: number,
    title?: string
  ): Promise<void> {
    await this.approvalService.pending(chatId);

    const name = title ? `${title} (${chatId})` : `Chat ${chatId}`;
    await this.bot.telegram.sendMessage(
      this.env.ADMIN_CHAT_ID,
      `${name} запросил доступ`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Разрешить', callback_data: `chat_approve:${chatId}` },
              { text: 'Забанить', callback_data: `chat_ban:${chatId}` },
            ],
          ],
        },
      }
    );
  }
}

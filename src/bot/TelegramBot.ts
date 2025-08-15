import assert from 'node:assert';

import { inject, injectable } from 'inversify';
import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { registerRoutes } from '../infrastructure/telegramRouter';
import {
  CHAT_REPOSITORY_ID,
  type ChatRepository,
} from '../repositories/interfaces/ChatRepository.interface';
import {
  ADMIN_SERVICE_ID,
  AdminService,
} from '../services/admin/AdminService.interface';
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
import { TriggerContext } from '../triggers/Trigger.interface';
import { windows } from './windowConfig';

export async function withTyping(
  ctx: Context,
  fn: () => Promise<void>
): Promise<void> {
  await ctx.sendChatAction('typing');
  const chatId = ctx.chat?.id;

  const timer = setInterval(() => {
    if (chatId !== undefined) {
      ctx.telegram.sendChatAction(chatId, 'typing').catch(() => {});
    }
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
  private router: ReturnType<typeof registerRoutes>;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(ChatMemoryManager) private memories: ChatMemoryManager,
    @inject(ADMIN_SERVICE_ID) private admin: AdminService,
    @inject(CHAT_APPROVAL_SERVICE_ID)
    private approvalService: ChatApprovalService,
    @inject(MESSAGE_CONTEXT_EXTRACTOR_ID)
    private extractor: MessageContextExtractor,
    @inject(TRIGGER_PIPELINE_ID) private pipeline: TriggerPipeline,
    @inject(CHAT_RESPONDER_ID) private responder: ChatResponder,
    @inject(CHAT_REPOSITORY_ID) private chatRepo: ChatRepository
  ) {
    this.env = envService.env;
    this.bot = new Telegraf(this.env.BOT_TOKEN);
    this.router = registerRoutes(this.bot, windows, {
      exportData: (ctx) => this.handleExportData(ctx),
      resetMemory: (ctx) => this.handleResetMemory(ctx),
      showAdminChatsMenu: (ctx) => this.showAdminChatsMenu(ctx),
      requestChatAccess: (ctx) => this.handleChatRequest(ctx),
      requestUserAccess: (ctx) => this.handleRequestAccess(ctx),
    });
    this.configure();
  }

  public async launch(): Promise<void> {
    logger.info('Launching bot');
    await this.bot.telegram
      .deleteWebhook()
      .catch((err) =>
        logger.warn({ err }, 'Failed to delete existing webhook')
      );
    await this.bot.launch();
    logger.info('Bot launched');
  }

  public stop(reason: string): void {
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

  private configure(): void {
    this.bot.start((ctx) => this.showMenu(ctx));
    this.bot.command('menu', (ctx) => this.showMenu(ctx));

    this.bot.telegram
      .setMyCommands([{ command: 'menu', description: 'Показать меню' }])
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
        await this.router.show(ctx, 'chat_not_approved');
      }
    });

    // Обработчики кнопок навигации и действий регистрируются в registerRoutes

    this.bot.action(/^admin_chat:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      const status = await this.approvalService.getStatus(chatId);
      await ctx.answerCbQuery();
      await ctx.reply(`Статус чата ${chatId}: ${status}`, {
        reply_markup: {
          inline_keyboard: [
            [
              status === 'banned'
                ? { text: 'Разбанить', callback_data: `chat_unban:${chatId}` }
                : { text: 'Забанить', callback_data: `chat_ban:${chatId}` },
            ],
          ],
        },
      });
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
      await ctx.editMessageText(`Чат ${chatId} забанен`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Разбанить', callback_data: `chat_unban:${chatId}` }],
          ],
        },
      });
      logger.info({ chatId }, 'Chat access banned successfully');
    });

    this.bot.action(/^chat_unban:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      await this.approvalService.unban(chatId);
      await ctx.answerCbQuery('Чат разбанен');
      await ctx.editMessageText(`Чат ${chatId} разбанен`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Забанить', callback_data: `chat_ban:${chatId}` }],
          ],
        },
      });
      await ctx.telegram.sendMessage(chatId, 'Доступ разрешён');
    });

    this.bot.action(/^user_approve:(\S+):(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      const userId = Number(ctx.match[2]);
      const expiresAt = await this.admin.createAccessKey(chatId, userId);
      await ctx.answerCbQuery('Доступ одобрен');
      await ctx.reply(`Одобрено для чата ${chatId} и пользователя ${userId}`);
      await ctx.telegram.sendMessage(
        chatId,
        `Доступ к данным разрешен для пользователя ${userId} до ${expiresAt.toISOString()}. Используйте меню для экспорта и сброса`
      );
    });

    this.bot.on(message('text'), (ctx) => this.handleText(ctx));
  }

  private async showMenu(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');

    if (chatId === this.env.ADMIN_CHAT_ID) {
      await this.router.show(ctx, 'admin_menu');
      return;
    }

    const status = await this.approvalService.getStatus(chatId);
    if (status === 'banned') {
      await ctx.reply('Доступ к боту запрещён.');
      return;
    }
    if (status !== 'approved') {
      await this.router.show(ctx, 'chat_not_approved');
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;
    const allowed = await this.admin.hasAccess(chatId, userId);
    if (!allowed) {
      await this.router.show(ctx, 'no_access');
      return;
    }

    await this.router.show(ctx, 'menu');
  }

  private async showAdminChatsMenu(ctx: Context): Promise<void> {
    const chats = await this.approvalService.listAll();
    if (chats.length === 0) {
      await ctx.reply('Нет чатов для управления');
      return;
    }

    const keyboard = await Promise.all(
      chats.map(async ({ chatId }) => {
        const chat = await this.chatRepo.findById(chatId);
        const title = chat?.title ?? 'Без названия';
        return [
          {
            text: `${title} (${chatId})`,
            callback_data: `admin_chat:${chatId}`,
          },
        ];
      })
    );

    await ctx.reply('Выберите чат для управления:', {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private async handleChatRequest(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');
    const title = ctx.chat && 'title' in ctx.chat ? ctx.chat.title : undefined;
    logger.info({ chatId, title }, 'Chat access request received');
    await this.sendChatApprovalRequest(chatId, title);
    await ctx.reply('Запрос отправлен');
    logger.info({ chatId }, 'Chat access request sent to admin');
  }

  private async handleRequestAccess(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    assert(chatId, 'This is not a chat');
    assert(userId, 'No user id');
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;
    const username = ctx.from?.username;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const usernamePart = username ? ` @${username}` : '';
    const approveData = `user_approve:${chatId}:${userId}`;
    const msg = `Chat ${chatId} user ${userId} (${fullName}${usernamePart}) requests data access.`;
    await ctx.telegram.sendMessage(this.env.ADMIN_CHAT_ID, msg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Одобрить', callback_data: approveData },
            { text: 'Забанить чат', callback_data: `chat_ban:${chatId}` },
          ],
        ],
      },
    });
    await ctx.reply('Запрос отправлен администратору.');
  }

  private async handleExportData(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    assert(chatId, 'This is not a chat');
    assert(userId, 'No user id');

    if (chatId !== this.env.ADMIN_CHAT_ID) {
      const allowed = await this.admin.hasAccess(chatId, userId);
      if (!allowed) {
        await ctx.answerCbQuery('Нет доступа или ключ просрочен');
        return;
      }
    }

    await ctx.answerCbQuery('Начинаю загрузку данных...');

    try {
      const files =
        chatId === this.env.ADMIN_CHAT_ID
          ? await this.admin.exportTables()
          : await this.admin.exportChatData(chatId);
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
  }

  private async handleResetMemory(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    assert(chatId, 'This is not a chat');
    assert(userId, 'No user id');

    if (chatId !== this.env.ADMIN_CHAT_ID) {
      const allowed = await this.admin.hasAccess(chatId, userId);
      if (!allowed) {
        await ctx.answerCbQuery('Нет доступа или ключ просрочен');
        return;
      }
    }

    await ctx.answerCbQuery('Сбрасываю память диалога...');

    try {
      await this.memories.reset(chatId);
      await ctx.reply('✅ Контекст диалога сброшен!');
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to reset memory');
      await ctx.reply('❌ Ошибка при сбросе памяти. Попробуйте позже.');
    }
  }

  private async handleText(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(!!chatId, 'This is not a chat');
    if (chatId === this.env.ADMIN_CHAT_ID) {
      logger.debug({ chatId }, 'Ignoring admin chat message');
      return;
    }

    logger.debug({ chatId }, 'Received text message');

    const status = await this.approvalService.getStatus(chatId);
    if (status === 'pending') {
      const title =
        ctx.chat && 'title' in ctx.chat ? ctx.chat.title : undefined;
      await this.sendChatApprovalRequest(chatId, title);

      return;
    }

    if (status === 'banned') {
      logger.warn({ chatId }, 'Message from banned chat ignored');
      return;
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
}

import assert from 'node:assert';

import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import type { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import type { AdminService } from '@/application/interfaces/admin/AdminService';
import { ADMIN_SERVICE_ID } from '@/application/interfaces/admin/AdminService';
import type { ChatApprovalService } from '@/application/interfaces/chat/ChatApprovalService';
import { CHAT_APPROVAL_SERVICE_ID } from '@/application/interfaces/chat/ChatApprovalService';
import type { ChatConfigService } from '@/application/interfaces/chat/ChatConfigService';
import { CHAT_CONFIG_SERVICE_ID } from '@/application/interfaces/chat/ChatConfigService';
import {
  InvalidHistoryLimitError,
  InvalidInterestIntervalError,
  InvalidTopicTimeError,
} from '@/application/interfaces/chat/ChatConfigService.errors';
import type { ChatMemoryManager } from '@/application/interfaces/chat/ChatMemoryManager';
import { CHAT_MEMORY_MANAGER_ID } from '@/application/interfaces/chat/ChatMemoryManager';
import type { ChatMessenger } from '@/application/interfaces/chat/ChatMessenger';
import { CHAT_MESSENGER_ID } from '@/application/interfaces/chat/ChatMessenger';
import type { ChatResponder } from '@/application/interfaces/chat/ChatResponder';
import { CHAT_RESPONDER_ID } from '@/application/interfaces/chat/ChatResponder';
import type { TriggerPipeline } from '@/application/interfaces/chat/TriggerPipeline';
import { TRIGGER_PIPELINE_ID } from '@/application/interfaces/chat/TriggerPipeline';
import type { Env, EnvService } from '@/application/interfaces/env/EnvService';
import { ENV_SERVICE_ID } from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import type { MessageContextExtractor } from '@/application/interfaces/messages/MessageContextExtractor';
import { MESSAGE_CONTEXT_EXTRACTOR_ID } from '@/application/interfaces/messages/MessageContextExtractor';
import {
  TOPIC_OF_DAY_SCHEDULER_ID,
  type TopicOfDayScheduler,
} from '@/application/interfaces/scheduler/TopicOfDayScheduler';
import { MessageFactory } from '@/application/use-cases/messages/MessageFactory';
import type { TriggerContext } from '@/domain/triggers/Trigger';

import type { Actions } from './routerConfig';

async function withTyping(
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
export class MainService {
  public readonly actions: Actions = {
    exportData: async () => {
      const ctx = this.ensureCtx();
      await this.handleExportData(ctx);
    },
    resetMemory: async () => {
      const ctx = this.ensureCtx();
      await this.handleResetMemory(ctx);
    },
    requestChatAccess: async () => {
      const ctx = this.ensureCtx();
      await this.handleChatRequest(ctx);
    },
    requestUserAccess: async () => {
      const ctx = this.ensureCtx();
      await this.handleRequestAccess(ctx);
    },
    setHistoryLimit: async (chatId, value) => {
      await this.admin.setHistoryLimit(chatId, value);
    },
    setInterestInterval: async (chatId, value) => {
      await this.admin.setInterestInterval(chatId, value);
    },
    setTopicTime: async (chatId, time, timezone) => {
      await this.chatConfig.setTopicTime(chatId, time, timezone);
    },
    rescheduleTopic: async (chatId) => {
      await this.scheduler.reschedule(chatId);
    },
    loadChatSettings: async () => {
      const ctx = this.ensureCtx();
      const chatId = ctx.chat?.id;
      assert(chatId, 'This is not a chat');
      const config = await this.chatConfig.getConfig(chatId);
      return {
        historyLimit: config.historyLimit,
        interestInterval: config.interestInterval,
        topicTime: config.topicTime,
        topicTimezone: config.topicTimezone,
      };
    },
    loadAdminChats: async () => {
      const chats = await this.approvalService.listAll();
      const result: { id: number; title: string }[] = [];
      for (const c of chats) {
        let title = '';
        try {
          const info = await this.messenger.bot.telegram.getChat(c.chatId);
          title =
            'title' in info ? ((info as { title?: string }).title ?? '') : '';
        } catch {
          /* ignore */
        }
        result.push({ id: c.chatId, title });
      }
      return result;
    },
    loadAdminChat: async (chatId) => {
      const [status, config] = await Promise.all([
        this.approvalService.getStatus(chatId),
        this.chatConfig.getConfig(chatId),
      ]);
      return {
        chatId,
        status,
        config: {
          historyLimit: config.historyLimit,
          interestInterval: config.interestInterval,
          topicTime: config.topicTime,
          topicTimezone: config.topicTimezone,
        },
      };
    },
    approveChat: async (chatId) => {
      await this.approvalService.approve(chatId);
      await this.messenger.sendMessage(chatId, 'Доступ разрешён');
    },
    banChat: async (chatId) => {
      await this.approvalService.ban(chatId);
      await this.messenger.sendMessage(chatId, 'Доступ запрещён');
    },
    unbanChat: async (chatId) => {
      await this.approvalService.unban(chatId);
      await this.messenger.sendMessage(chatId, 'Доступ разрешён');
    },
    approveUser: async (chatId, userId) => {
      const expires = await this.admin.createAccessKey(chatId, userId);
      await this.messenger.sendMessage(
        chatId,
        `Доступ к данным разрешен для пользователя ${userId} до ${expires.toISOString()}. Используйте меню для экспорта и сброса`
      );
    },
  };
  private readonly bot: Telegraf;
  private env: Env;
  private awaitingConfig = new Map<
    number,
    {
      type: 'history' | 'interest' | 'topic';
      chatId: number;
      admin: boolean;
      topicTime?: string;
      topicTimezone?: string;
    }
  >();
  private readonly logger: Logger;
  private readonly messenger: ChatMessenger;
  private readonly scheduler: TopicOfDayScheduler;
  private ctx?: Context;
  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(CHAT_MEMORY_MANAGER_ID) private memories: ChatMemoryManager,
    @inject(ADMIN_SERVICE_ID) private admin: AdminService,
    @inject(CHAT_APPROVAL_SERVICE_ID)
    private approvalService: ChatApprovalService,
    @inject(MESSAGE_CONTEXT_EXTRACTOR_ID)
    private extractor: MessageContextExtractor,
    @inject(TRIGGER_PIPELINE_ID) private pipeline: TriggerPipeline,
    @inject(CHAT_RESPONDER_ID) private responder: ChatResponder,
    @inject(CHAT_CONFIG_SERVICE_ID) private chatConfig: ChatConfigService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory,
    @inject(new LazyServiceIdentifier(() => TOPIC_OF_DAY_SCHEDULER_ID))
    scheduler: TopicOfDayScheduler,
    @inject(CHAT_MESSENGER_ID)
    messenger: ChatMessenger
  ) {
    this.env = envService.env;
    this.messenger = messenger;
    this.bot = messenger.bot;
    this.scheduler = scheduler;
    this.logger = loggerFactory.create('MainService');
    this.configure();
  }

  public async launch(): Promise<void> {
    await this.messenger.launch();
    void this.scheduler.start();
  }

  public stop(reason: string): void {
    this.messenger.stop(reason);
  }

  public async sendChatApprovalRequest(
    chatId: number,
    title?: string
  ): Promise<void> {
    await this.approvalService.pending(chatId);
    const name = title ? `${title} (${chatId})` : `Chat ${chatId}`;
    await this.messenger.sendMessage(
      this.env.ADMIN_CHAT_ID,
      `Chat ${name} requests access`
    );
  }

  private ensureCtx(): Context {
    assert(this.ctx, 'No context');
    return this.ctx;
  }

  private configure(): void {
    this.bot.use((ctx, next) => {
      this.ctx = ctx;
      return next();
    });
    this.bot.start(async (ctx) => {
      try {
        await ctx.reply('Бот запущен');
      } catch (error) {
        this.logger.error(
          { error, chatId: ctx.chat?.id, userId: ctx.from?.id },
          'Failed to handle /start'
        );
      }
    });
    this.bot.command('menu', async (ctx) => {
      try {
        await ctx.reply('Меню отключено');
      } catch (error) {
        this.logger.error(
          { error, chatId: ctx.chat?.id, userId: ctx.from?.id },
          'Failed to handle /menu'
        );
      }
    });

    this.bot.telegram
      .setMyCommands([{ command: 'menu', description: 'Показать меню' }])
      .catch((err) => this.logger.error({ err }, 'Failed to set bot commands'));

    this.bot.on('my_chat_member', async (ctx) => {
      const chatId = ctx.chat?.id;
      assert(chatId, 'This is not a chat');
      this.logger.info({ chatId }, 'Bot added to chat');
      try {
        const status = await this.approvalService.getStatus(chatId);
        if (status !== 'approved') {
          this.logger.info(
            { chatId, status },
            'Chat not approved, showing request access button'
          );
          await ctx.reply('Чат не одобрен');
        }
      } catch (error) {
        this.logger.error(
          { error, chatId },
          'Failed to handle my_chat_member event'
        );
      }
    });

    this.bot.action(/^admin_chat_history_limit:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      try {
        await ctx.answerCbQuery();
        await this.handleAdminConfigHistoryLimit(ctx, chatId);
      } catch (error) {
        this.logger.error(
          { error, chatId, adminChatId },
          'Failed to handle admin history limit'
        );
      }
    });

    this.bot.action(/^admin_chat_interest_interval:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      try {
        await ctx.answerCbQuery();
        await this.handleAdminConfigInterestInterval(ctx, chatId);
      } catch (error) {
        this.logger.error(
          { error, chatId, adminChatId },
          'Failed to handle admin interest interval'
        );
      }
    });

    this.bot.action(/^admin_chat_topic_time:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      try {
        await ctx.answerCbQuery();
        await this.handleAdminConfigTopicTime(ctx, chatId);
      } catch (error) {
        this.logger.error(
          { error, chatId, adminChatId },
          'Failed to handle admin topic time'
        );
      }
    });

    this.bot.action(/^chat_approve:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        this.logger.warn(
          { adminChatId, requestChatId: ctx.chat?.id },
          'Unauthorized chat approval attempt'
        );
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      this.logger.info({ chatId, adminChatId }, 'Approving chat access');
      try {
        await this.approvalService.approve(chatId);
        await ctx.answerCbQuery('Чат одобрен');
        await this.messenger.sendMessage(chatId, 'Доступ разрешён');
        this.logger.info({ chatId }, 'Chat access approved successfully');
      } catch (error) {
        this.logger.error({ error, chatId }, 'Failed to approve chat access');
        await ctx.answerCbQuery('Ошибка при одобрении чата');
      }
    });

    this.bot.action(/^chat_ban:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        this.logger.warn(
          { adminChatId, requestChatId: ctx.chat?.id },
          'Unauthorized chat ban attempt'
        );
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      this.logger.info({ chatId, adminChatId }, 'Banning chat access');
      try {
        await this.approvalService.ban(chatId);
        await ctx.answerCbQuery('Чат забанен');
        await this.messenger.sendMessage(chatId, 'Доступ запрещён');
        await ctx.deleteMessage().catch(() => {});
        this.logger.info({ chatId }, 'Chat access banned successfully');
      } catch (error) {
        this.logger.error({ error, chatId }, 'Failed to ban chat access');
        await ctx.answerCbQuery('Ошибка при блокировке чата');
      }
    });

    this.bot.action(/^chat_unban:(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      try {
        await this.approvalService.unban(chatId);
        await ctx.answerCbQuery('Чат разбанен');
        await this.messenger.sendMessage(chatId, 'Доступ разрешён');
        await ctx.deleteMessage().catch(() => {});
      } catch (error) {
        this.logger.error({ error, chatId }, 'Failed to unban chat');
        await ctx.answerCbQuery('Ошибка при разбане чата');
      }
    });

    this.bot.action(/^user_approve:(\S+):(\S+)$/, async (ctx) => {
      const adminChatId = this.env.ADMIN_CHAT_ID;
      if (ctx.chat?.id !== adminChatId) {
        await ctx.answerCbQuery();
        return;
      }
      const chatId = Number(ctx.match[1]);
      const userId = Number(ctx.match[2]);
      try {
        const expiresAt = await this.admin.createAccessKey(chatId, userId);
        await ctx.answerCbQuery('Доступ одобрен');
        await ctx.reply(`Одобрено для чата ${chatId} и пользователя ${userId}`);
        await this.messenger.sendMessage(
          chatId,
          `Доступ к данным разрешен для пользователя ${userId} до ${expiresAt.toISOString()}. Используйте меню для экспорта и сброса`
        );
      } catch (error) {
        this.logger.error(
          { error, chatId, userId },
          'Failed to approve user access'
        );
        await ctx.answerCbQuery('Ошибка при одобрении доступа');
      }
    });

    this.bot.on(message('text'), async (ctx) => {
      try {
        await this.handleText(ctx);
      } catch (error) {
        this.logger.error(
          { error, chatId: ctx.chat?.id, userId: ctx.from?.id },
          'Failed to handle text message'
        );
      }
    });
  }

  private async handleChatRequest(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');
    const title = ctx.chat && 'title' in ctx.chat ? ctx.chat.title : undefined;
    this.logger.info({ chatId, title }, 'Chat access request received');
    await this.sendChatApprovalRequest(chatId, title);
    await ctx.reply('Запрос отправлен');
    this.logger.info({ chatId }, 'Chat access request sent to admin');
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
    const msg = `Chat ${chatId} user ${userId} (${fullName}${usernamePart}) requests data access.`;
    await this.messenger.sendMessage(this.env.ADMIN_CHAT_ID, msg);
    await ctx.reply('Запрос отправлен администратору.');
  }

  private async handleExportData(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    assert(chatId, 'This is not a chat');
    assert(userId, 'No user id');
    this.logger.info({ chatId, userId }, 'Export data requested');

    if (chatId !== this.env.ADMIN_CHAT_ID) {
      const allowed = await this.admin.hasAccess(chatId, userId);
      if (!allowed) {
        this.logger.warn({ chatId, userId }, 'Export data access denied');
        await ctx.answerCbQuery('Нет доступа или ключ просрочен');
        await ctx.reply('Нет доступа');
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
        this.logger.info({ chatId, userId }, 'No data to export');
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
      this.logger.info(
        { chatId, userId, tables: files.length },
        'Data export completed'
      );
    } catch (error) {
      this.logger.error({ error, chatId, userId }, 'Failed to export data');
      await ctx.reply('❌ Ошибка при загрузке данных. Попробуйте позже.');
    }
  }

  private async handleConfigHistoryLimit(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    assert(chatId, 'This is not a chat');
    this.logger.info({ chatId, userId }, 'Config history limit requested');
    this.awaitingConfig.set(chatId, {
      type: 'history',
      chatId,
      admin: false,
    });
    await ctx.reply('Введите новый лимит истории');
    this.logger.info({ chatId, userId }, 'Prompted for history limit');
  }

  private async handleConfigInterestInterval(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');
    this.awaitingConfig.set(chatId, {
      type: 'interest',
      chatId,
      admin: false,
    });
    await ctx.reply('Введите новый интервал интереса');
  }

  private async handleConfigTopicTime(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');
    this.awaitingConfig.set(chatId, {
      type: 'topic',
      chatId,
      admin: false,
    });
    await ctx.reply('Введите новое время темы');
  }

  private async handleAdminConfigHistoryLimit(
    ctx: Context,
    targetChatId: number
  ): Promise<void> {
    const adminChatId = ctx.chat?.id;
    assert(adminChatId, 'This is not a chat');
    this.awaitingConfig.set(adminChatId, {
      type: 'history',
      chatId: targetChatId,
      admin: true,
    });
    await ctx.reply(`Введите новый лимит истории для чата ${targetChatId}`);
  }

  private async handleAdminConfigInterestInterval(
    ctx: Context,
    targetChatId: number
  ): Promise<void> {
    const adminChatId = ctx.chat?.id;
    assert(adminChatId, 'This is not a chat');
    this.awaitingConfig.set(adminChatId, {
      type: 'interest',
      chatId: targetChatId,
      admin: true,
    });
    await ctx.reply(`Введите новый интервал интереса для чата ${targetChatId}`);
  }

  private async handleAdminConfigTopicTime(
    ctx: Context,
    targetChatId: number
  ): Promise<void> {
    const adminChatId = ctx.chat?.id;
    assert(adminChatId, 'This is not a chat');
    this.awaitingConfig.set(adminChatId, {
      type: 'topic',
      chatId: targetChatId,
      admin: true,
    });
    await ctx.reply(`Введите новое время темы для чата ${targetChatId}`);
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
      this.logger.error({ error, chatId }, 'Failed to reset memory');
      await ctx.reply('❌ Ошибка при сбросе памяти. Попробуйте позже.');
    }
  }

  private async handleText(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(!!chatId, 'This is not a chat');
    const awaiting = this.awaitingConfig.get(chatId);
    if (awaiting) {
      this.awaitingConfig.delete(chatId);
      await this.handleAwaitingConfig(ctx, awaiting);
      return;
    }
    if (chatId === this.env.ADMIN_CHAT_ID) {
      this.logger.debug({ chatId }, 'Ignoring admin chat message');
      return;
    }

    this.logger.debug({ chatId }, 'Received text message');
    const allowed = await this.checkChatStatus(ctx, chatId);
    if (!allowed) return;

    await this.prepareAndSendResponse(ctx, chatId);
  }

  private async handleAwaitingConfig(
    ctx: Context,
    awaiting: {
      type: 'history' | 'interest' | 'topic';
      chatId: number;
      admin: boolean;
      topicTime?: string;
      topicTimezone?: string;
    }
  ): Promise<void> {
    const text =
      ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    const value = Number(text);
    try {
      if (awaiting.type === 'history') {
        if (awaiting.admin) {
          await this.admin.setHistoryLimit(awaiting.chatId, value);
        } else {
          await this.chatConfig.setHistoryLimit(awaiting.chatId, value);
        }
        await ctx.reply('✅ Лимит истории обновлён');
      } else if (awaiting.type === 'interest') {
        if (awaiting.admin) {
          await this.admin.setInterestInterval(awaiting.chatId, value);
        } else {
          await this.chatConfig.setInterestInterval(awaiting.chatId, value);
        }
        await ctx.reply('✅ Интервал интереса обновлён');
      } else {
        if (!awaiting.topicTime) {
          const time = text ?? '';
          const date =
            ctx.message && 'date' in ctx.message
              ? new Date(ctx.message.date * 1000)
              : new Date();
          const offset = -date.getTimezoneOffset();
          const hours = Math.floor(offset / 60);
          const sign = hours >= 0 ? '+' : '-';
          const timezone = `UTC${sign}${String(Math.abs(hours)).padStart(2, '0')}`;
          const key = ctx.chat?.id;
          assert(key, 'This is not a chat');
          this.awaitingConfig.set(key, {
            ...awaiting,
            topicTime: time,
            topicTimezone: timezone,
          });
          const prompt = awaiting.admin
            ? `Введите часовой пояс для чата ${awaiting.chatId}`
            : 'Введите часовой пояс';
          await ctx.reply(prompt);
          return;
        }
        const time = awaiting.topicTime;
        const timezone =
          text && text.trim() !== '' ? text : (awaiting.topicTimezone ?? 'UTC');
        await this.chatConfig.setTopicTime(awaiting.chatId, time, timezone);
        await this.scheduler?.reschedule(awaiting.chatId);
        await ctx.reply('✅ Время статьи обновлено');
      }
    } catch (error) {
      this.logger.error(
        { error, chatId: awaiting.chatId },
        'Failed to update chat config'
      );
      const message = (() => {
        if (error instanceof InvalidHistoryLimitError) {
          return '❌ Лимит истории должен быть целым числом от 1 до 50';
        }
        if (error instanceof InvalidInterestIntervalError) {
          return '❌ Интервал интереса должен быть целым числом от 1 до 50';
        }
        if (error instanceof InvalidTopicTimeError) {
          return '❌ Время статьи должно быть в формате HH:MM';
        }
        return '❌ Ошибка при обновлении параметра';
      })();
      await ctx.reply(message);
    }
    await ctx.reply('Готово');
  }

  private async checkChatStatus(
    ctx: Context,
    chatId: number
  ): Promise<boolean> {
    const status = await this.approvalService.getStatus(chatId);
    if (status !== 'approved') {
      if (status === 'banned') {
        this.logger.warn({ chatId }, 'Message from banned chat ignored');
      }
      await ctx.reply('Чат не одобрен');
      return false;
    }
    return true;
  }

  private async prepareAndSendResponse(
    ctx: Context,
    chatId: number
  ): Promise<void> {
    const meta = this.extractor.extract(ctx);
    const userMsg = MessageFactory.fromUser(ctx, meta);
    const memory = await this.memories.get(chatId);
    await memory.addMessage(userMsg);

    const context: TriggerContext = {
      text: `${userMsg.content};`,
      replyText: userMsg.replyText ?? '',
      chatId,
    };

    this.logger.debug({ chatId }, 'Checking triggers');
    const triggerResult = await this.pipeline.shouldRespond(ctx, context);
    if (!triggerResult) {
      this.logger.debug({ chatId }, 'No trigger matched');
      return;
    }

    await withTyping(ctx, async () => {
      this.logger.debug({ chatId }, 'Generating answer');
      const answer = await this.responder.generate(
        ctx,
        chatId,
        triggerResult.reason ?? undefined
      );
      this.logger.debug({ chatId }, 'Answer generated');

      const replyId = triggerResult.replyToMessageId ?? userMsg.messageId;
      ctx.reply(answer, {
        reply_parameters: replyId ? { message_id: replyId } : undefined,
      });
      this.logger.debug({ chatId }, 'Reply sent');
    });
  }
}

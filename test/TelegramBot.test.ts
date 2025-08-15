import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { TelegramBot } from '../src/bot/TelegramBot';
import * as TelegramBotModule from '../src/bot/TelegramBot';
import type { ChatRepository } from '../src/repositories/interfaces/ChatRepository.interface';
import type { AdminService } from '../src/services/admin/AdminService.interface';
import type { ChatApprovalService } from '../src/services/chat/ChatApprovalService';
import type { ChatMemoryManager } from '../src/services/chat/ChatMemory';
import type { ChatResponder } from '../src/services/chat/ChatResponder';
import type { TriggerPipeline } from '../src/services/chat/TriggerPipeline';
import type { EnvService } from '../src/services/env/EnvService';
import type {
  MessageContext,
  MessageContextExtractor,
} from '../src/services/messages/MessageContextExtractor';

class MockEnvService {
  env = { BOT_TOKEN: 'token', ADMIN_CHAT_ID: 1 } as EnvService['env'];
}

class MockChatMemory {
  addMessage = vi.fn();
  getHistory = vi.fn(async () => []);
}

class MockChatMemoryManager {
  memory = new MockChatMemory();
  get = vi.fn(() => this.memory);
  reset = vi.fn();
}

class DummyAdmin {
  hasAccess = vi.fn(async () => true);
  exportTables = vi.fn(async () => []);
  exportChatData = vi.fn(async () => []);
  createAccessKey = vi.fn(async () => new Date());
}

class DummyExtractor {
  extract(): MessageContext {
    return {} as MessageContext;
  }
}

class DummyPipeline {
  shouldRespond = vi.fn(async () => null);
}

class DummyResponder {
  generate = vi.fn(async () => '');
}

class DummyApprovalService {
  request = vi.fn(async () => {});
  approve = vi.fn(async () => {});
  ban = vi.fn(async () => {});
  unban = vi.fn(async () => {});
  getStatus = vi.fn(async () => 'approved');
  listAll = vi.fn(async () => []);
  pending = vi.fn(async () => {});
}

class DummyChatRepository {
  upsert = vi.fn(async () => {});
  findById = vi.fn(async () => undefined);
}

describe('TelegramBot', () => {
  it('stores user messages via ChatMemoryManager', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    // Мокаем approvalService.getStatus чтобы возвращать 'approved' и не показывать кнопки
    const mockApprovalService = {
      ...new DummyApprovalService(),
      getStatus: vi.fn(async () => 'approved'),
    };

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      mockApprovalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const ctx = {
      chat: { id: 2 },
      from: { id: 2 },
      message: { text: 'hi', message_id: 3 },
      reply: vi.fn(),
      answerCbQuery: vi.fn(),
    } as unknown as Context;

    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctx);

    expect(memories.get).toHaveBeenCalledWith(2);
    expect(memories.memory.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: 'hi' })
    );
  });

  it('shows admin chats menu', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    const approvalService = new DummyApprovalService();
    approvalService.listAll.mockResolvedValue([
      { chatId: 42, status: 'approved' },
    ]);

    const chatRepo = new DummyChatRepository();
    chatRepo.findById.mockResolvedValue({ chatId: 42, title: 'Test Chat' });

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      chatRepo as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;

    await (bot as unknown as { router: any }).router.show(ctx, 'admin_chats', {
      loadData: () =>
        (bot as unknown as { getChats: () => Promise<unknown> }).getChats(),
    });

    expect(approvalService.listAll).toHaveBeenCalled();
    expect(chatRepo.findById).toHaveBeenCalledWith(42);
    expect(ctx.reply).toHaveBeenCalledWith('Выберите чат для управления:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Test Chat (42)', callback_data: 'admin_chat:42' }],
        ],
      },
    });
  });

  it('handles admin_chat action and shows status with ban button', async () => {
    const memories = new MockChatMemoryManager();
    const approvalService = new DummyApprovalService();
    approvalService.getStatus.mockResolvedValue('approved');
    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );

    const call = actionSpy.mock.calls.find(
      ([pattern]) =>
        pattern instanceof RegExp && pattern.source === '^admin_chat:(\\S+)$'
    );
    actionSpy.mockRestore();
    if (!call) {
      throw new Error('Handler not found');
    }
    const handler = call[1];

    // simulate entering admin_chats route to populate history
    await (
      bot as unknown as { router: unknown } as { router: any }
    ).router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'admin_chats',
      { loadData: () => [] }
    );

    const ctx = {
      chat: { id: 1 },
      match: ['admin_chat:42', '42'],
      answerCbQuery: vi.fn(),
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
    } as unknown as Context;

    await handler(ctx);

    expect(approvalService.getStatus).toHaveBeenCalledWith(42);
    expect(ctx.deleteMessage).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Статус чата 42: approved', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Забанить', callback_data: 'chat_ban:42' }],
          [{ text: '⬅️ Назад', callback_data: 'back' }],
        ],
      },
    });
  });

  it('chat_ban updates message', async () => {
    const memories = new MockChatMemoryManager();
    const approvalService = new DummyApprovalService();
    approvalService.getStatus
      .mockResolvedValueOnce('approved')
      .mockResolvedValueOnce('banned');
    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );

    const call = actionSpy.mock.calls.find(
      ([pattern]) =>
        pattern instanceof RegExp && pattern.source === '^chat_ban:(\\S+)$'
    );
    actionSpy.mockRestore();
    if (!call) {
      throw new Error('Handler not found');
    }
    const handler = call[1];

    // navigate to admin_chat view for chat 7
    await (bot as unknown as { router: any }).router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'admin_chats',
      { loadData: () => [] }
    );
    await (
      bot as unknown as {
        showAdminChat: (ctx: Context, id: number) => Promise<void>;
      }
    ).showAdminChat(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      7
    );

    const ctx = {
      chat: { id: 1 },
      match: ['chat_ban:7', '7'],
      telegram: { sendMessage: vi.fn() },
      answerCbQuery: vi.fn(),
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
    } as unknown as Context;

    await handler(ctx);

    expect(approvalService.ban).toHaveBeenCalledWith(7);
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(7, 'Доступ запрещён');
    expect(ctx.deleteMessage).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Статус чата 7: banned', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Разбанить', callback_data: 'chat_unban:7' }],
          [{ text: '⬅️ Назад', callback_data: 'back' }],
        ],
      },
    });
  });

  it('sends chat access request to admin', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    const approvalService = new DummyApprovalService();
    const admin = new DummyAdmin();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const sendMessageSpy = vi
      .spyOn((bot as unknown as { bot: Telegraf }).bot.telegram, 'sendMessage')
      .mockResolvedValue(undefined as never);

    const ctx = {
      chat: { id: 42, title: 'Test' },
      reply: vi.fn(),
    } as unknown as Context;

    await (
      bot as unknown as { handleChatRequest: (ctx: Context) => Promise<void> }
    ).handleChatRequest(ctx);

    expect(approvalService.pending).toHaveBeenCalledWith(42);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      'Test (42) запросил доступ',
      expect.objectContaining({ reply_markup: expect.any(Object) })
    );
    expect(ctx.reply).toHaveBeenCalledWith('Запрос отправлен');
  });

  it('handles user access request and sends notification', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const sendMessageSpy = vi
      .spyOn((bot as unknown as { bot: Telegraf }).bot.telegram, 'sendMessage')
      .mockResolvedValue(undefined as never);

    const ctx = {
      chat: { id: 5 },
      from: {
        id: 6,
        first_name: 'John',
        last_name: 'Doe',
        username: 'jdoe',
      },
      reply: vi.fn(),
    } as unknown as Context;

    await (
      bot as unknown as { handleRequestAccess: (ctx: Context) => Promise<void> }
    ).handleRequestAccess(ctx);

    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      'Chat 5 user 6 (John Doe @jdoe) requests data access.',
      expect.objectContaining({ reply_markup: expect.any(Object) })
    );
    expect(ctx.reply).toHaveBeenCalledWith('Запрос отправлен администратору.');
  });

  it('handles user_approve action', async () => {
    const memories = new MockChatMemoryManager();
    const admin = new DummyAdmin();
    const approveDate = new Date('2020-01-01T00:00:00.000Z');
    admin.createAccessKey.mockResolvedValue(approveDate);
    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');

    new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );

    const call = actionSpy.mock.calls.find(
      ([pattern]) =>
        pattern instanceof RegExp &&
        pattern.source === '^user_approve:(\\S+):(\\S+)$'
    );
    actionSpy.mockRestore();
    if (!call) {
      throw new Error('Handler not found');
    }
    const handler = call[1];

    const ctx = {
      chat: { id: 1 },
      match: ['user_approve:5:6', '5', '6'],
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
      telegram: { sendMessage: vi.fn() },
    } as unknown as Context;

    await handler(ctx);

    expect(admin.createAccessKey).toHaveBeenCalledWith(5, 6);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Доступ одобрен');
    expect(ctx.reply).toHaveBeenCalledWith(
      'Одобрено для чата 5 и пользователя 6'
    );
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(
      5,
      `Доступ к данным разрешен для пользователя 6 до ${approveDate.toISOString()}. Используйте меню для экспорта и сброса`
    );
  });

  it('exports data when allowed', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    const admin = new DummyAdmin();
    const file = { buffer: Buffer.from('data'), filename: 'file.csv' };
    admin.exportChatData.mockResolvedValue([file]);

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const ctx = {
      chat: { id: 2 },
      from: { id: 3 },
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
      replyWithDocument: vi.fn(),
    } as unknown as Context;

    await (
      bot as unknown as { handleExportData: (ctx: Context) => Promise<void> }
    ).handleExportData(ctx);

    expect(admin.hasAccess).toHaveBeenCalledWith(2, 3);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'Начинаю загрузку данных...'
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      'Найдено 1 таблиц для экспорта. Начинаю загрузку...'
    );
    expect(ctx.replyWithDocument).toHaveBeenCalledWith({
      source: file.buffer,
      filename: file.filename,
    });
    expect(ctx.reply).toHaveBeenCalledWith('✅ Загрузка данных завершена!');
  });

  it('replies with error when export fails', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    const admin = new DummyAdmin();
    admin.exportChatData.mockRejectedValue(new Error('fail'));

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const ctx = {
      chat: { id: 2 },
      from: { id: 3 },
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
      replyWithDocument: vi.fn(),
    } as unknown as Context;

    await (
      bot as unknown as { handleExportData: (ctx: Context) => Promise<void> }
    ).handleExportData(ctx);

    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'Начинаю загрузку данных...'
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      '❌ Ошибка при загрузке данных. Попробуйте позже.'
    );
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
  });

  it('resets memory when allowed', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    const admin = new DummyAdmin();

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const ctx = {
      chat: { id: 2 },
      from: { id: 3 },
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
    } as unknown as Context;

    await (
      bot as unknown as { handleResetMemory: (ctx: Context) => Promise<void> }
    ).handleResetMemory(ctx);

    expect(admin.hasAccess).toHaveBeenCalledWith(2, 3);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'Сбрасываю память диалога...'
    );
    expect(memories.reset).toHaveBeenCalledWith(2);
    expect(ctx.reply).toHaveBeenCalledWith('✅ Контекст диалога сброшен!');
  });

  it('replies with error when memory reset fails', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});

    const admin = new DummyAdmin();
    memories.reset.mockRejectedValue(new Error('fail'));

    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();

    const ctx = {
      chat: { id: 2 },
      from: { id: 3 },
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
    } as unknown as Context;

    await (
      bot as unknown as { handleResetMemory: (ctx: Context) => Promise<void> }
    ).handleResetMemory(ctx);

    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'Сбрасываю память диалога...'
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      '❌ Ошибка при сбросе памяти. Попробуйте позже.'
    );
  });

  it('shows admin menu for admin chat', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});
    const approvalService = new DummyApprovalService();
    const admin = new DummyAdmin();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();
    const botWithRouter = bot as unknown as {
      router: { show: ReturnType<typeof vi.fn> };
      showMenu: (ctx: Context) => Promise<void>;
    };
    botWithRouter.router = { show: vi.fn() };
    const ctx = { chat: { id: 1 } } as unknown as Context;
    await botWithRouter.showMenu(ctx);
    expect(botWithRouter.router.show).toHaveBeenCalledWith(ctx, 'admin_menu', {
      resetStack: true,
    });
  });

  it('shows banned and pending states in menu', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});
    const approvalService = new DummyApprovalService();
    const admin = new DummyAdmin();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();
    const botWithRouter = bot as unknown as {
      router: { show: ReturnType<typeof vi.fn> };
      showMenu: (ctx: Context) => Promise<void>;
    };
    botWithRouter.router = { show: vi.fn() };
    approvalService.getStatus.mockResolvedValueOnce('banned');
    const bannedCtx = { chat: { id: 2 }, reply: vi.fn() } as unknown as Context;
    await botWithRouter.showMenu(bannedCtx);
    expect(bannedCtx.reply).toHaveBeenCalledWith('Доступ к боту запрещён.');
    approvalService.getStatus.mockResolvedValueOnce('pending');
    const pendingCtx = { chat: { id: 3 } } as unknown as Context;
    await botWithRouter.showMenu(pendingCtx);
    expect(botWithRouter.router.show).toHaveBeenLastCalledWith(
      pendingCtx,
      'chat_not_approved',
      { resetStack: true }
    );
  });

  it('shows no access when user lacks permission', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});
    const approvalService = new DummyApprovalService();
    const admin = new DummyAdmin();
    admin.hasAccess.mockResolvedValue(false);
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();
    const botWithRouter = bot as unknown as {
      router: { show: ReturnType<typeof vi.fn> };
      showMenu: (ctx: Context) => Promise<void>;
    };
    botWithRouter.router = { show: vi.fn() };
    const ctx = { chat: { id: 2 }, from: { id: 5 } } as unknown as Context;
    await botWithRouter.showMenu(ctx);
    expect(botWithRouter.router.show).toHaveBeenCalledWith(ctx, 'no_access', {
      resetStack: true,
    });
  });

  it('handles pending and banned chats in text handler', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});
    const approvalService = new DummyApprovalService();
    const admin = new DummyAdmin();
    approvalService.getStatus.mockResolvedValueOnce('pending');
    approvalService.getStatus.mockResolvedValueOnce('banned');
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();
    const sendRequest = vi
      .spyOn(
        bot as unknown as {
          sendChatApprovalRequest: (
            chatId: number,
            title?: string
          ) => Promise<void>;
        },
        'sendChatApprovalRequest'
      )
      .mockResolvedValue();
    const ctxPending = {
      chat: { id: 2 },
      from: { id: 1 },
      message: { text: 'hi', message_id: 1 },
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxPending);
    expect(sendRequest).toHaveBeenCalledWith(2, undefined);
    const ctxBanned = {
      chat: { id: 3 },
      from: { id: 1 },
      message: { text: 'hi', message_id: 1 },
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxBanned);
    expect(memories.memory.addMessage).not.toHaveBeenCalled();
  });

  it('denies export when access is missing', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});
    const admin = new DummyAdmin();
    admin.hasAccess.mockResolvedValue(false);
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();
    const ctx = {
      chat: { id: 2 },
      from: { id: 3 },
      answerCbQuery: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleExportData: (ctx: Context) => Promise<void> }
    ).handleExportData(ctx);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'Нет доступа или ключ просрочен'
    );
  });

  it('launches and stops the bot', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatRepository() as unknown as ChatRepository
    );
    configureSpy.mockRestore();
    const deleteWebhook = vi
      .spyOn(
        (bot as unknown as { bot: Telegraf }).bot.telegram,
        'deleteWebhook'
      )
      .mockResolvedValue(undefined as never);
    const launch = vi
      .spyOn((bot as unknown as { bot: Telegraf }).bot, 'launch')
      .mockResolvedValue(undefined as never);
    await bot.launch();
    expect(deleteWebhook).toHaveBeenCalled();
    expect(launch).toHaveBeenCalled();
    const stop = vi
      .spyOn((bot as unknown as { bot: Telegraf }).bot, 'stop')
      .mockImplementation(() => {});
    bot.stop('test');
    expect(stop).toHaveBeenCalledWith('test');
  });

  it('withTyping sends actions until finished', async () => {
    vi.useFakeTimers();

    const ctx = {
      chat: { id: 1 },
      sendChatAction: vi.fn().mockResolvedValue(undefined),
      telegram: { sendChatAction: vi.fn().mockResolvedValue(undefined) },
    } as unknown as Context;

    let resolveFn: () => void;
    const fn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        })
    );

    const promise = (
      TelegramBotModule as unknown as {
        withTyping: (ctx: Context, fn: () => Promise<void>) => Promise<void>;
      }
    ).withTyping(ctx, fn);

    expect(ctx.sendChatAction).toHaveBeenCalledWith('typing');

    await vi.advanceTimersByTimeAsync(4000);
    expect(ctx.telegram.sendChatAction).toHaveBeenCalledWith(1, 'typing');

    resolveFn?.();
    await promise;

    await vi.advanceTimersByTimeAsync(4000);
    expect(ctx.telegram.sendChatAction).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

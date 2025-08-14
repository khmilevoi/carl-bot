import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { TelegramBot } from '../src/bot/TelegramBot';
import { TriggerReason } from '../src/triggers/Trigger';

class MockEnvService {
  env = { BOT_TOKEN: 'token', ADMIN_CHAT_ID: 1 } as any;
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
  extract() {
    return {};
  }
}

class DummyPipeline {
  shouldRespond = vi.fn(async () => null);
}

class DummyResponder {
  generate = vi.fn(
    async (_ctx?: any, _id?: number, _reason?: TriggerReason) => ''
  );
}

class DummyApprovalService {
  request = vi.fn(async () => {});
  approve = vi.fn(async () => {});
  ban = vi.fn(async () => {});
  unban = vi.fn(async () => {});
  getStatus = vi.fn(async () => 'approved');
  listAll = vi.fn(async () => []);
}

describe('TelegramBot', () => {
  it('stores user messages via ChatMemoryManager', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(TelegramBot.prototype as any, 'configure')
      .mockImplementation(() => {});

    // Мокаем approvalService.getStatus чтобы возвращать 'approved' и не показывать кнопки
    const mockApprovalService = {
      ...new DummyApprovalService(),
      getStatus: vi.fn(async () => 'approved'),
    };

    const bot = new TelegramBot(
      new MockEnvService() as any,
      memories as any,
      new DummyAdmin() as any,
      mockApprovalService as any,
      new DummyExtractor() as any,
      new DummyPipeline() as any,
      new DummyResponder() as any
    );
    configureSpy.mockRestore();

    const ctx: any = {
      chat: { id: 2 },
      from: { id: 2 },
      message: { text: 'hi', message_id: 3 },
      reply: vi.fn(),
      answerCbQuery: vi.fn(),
    };

    await (bot as any).handleText(ctx);

    expect(memories.get).toHaveBeenCalledWith(2);
    expect(memories.memory.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: 'hi' })
    );
  });

  it('shows admin menu with chats', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(TelegramBot.prototype as any, 'configure')
      .mockImplementation(() => {});

    const approvalService = new DummyApprovalService();
    approvalService.listAll.mockResolvedValue([
      { chatId: 42, status: 'approved' },
    ] as any);

    const bot = new TelegramBot(
      new MockEnvService() as any,
      memories as any,
      new DummyAdmin() as any,
      approvalService as any,
      new DummyExtractor() as any,
      new DummyPipeline() as any,
      new DummyResponder() as any
    );
    configureSpy.mockRestore();

    const ctx: any = { reply: vi.fn() };

    await (bot as any).showAdminMenu(ctx);

    expect(approvalService.listAll).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Выберите чат для управления:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '42 (approved)', callback_data: 'admin_chat:42' }],
        ],
      },
    });
  });

  it('handles admin_chat action and shows status with ban button', async () => {
    const memories = new MockChatMemoryManager();
    const approvalService = new DummyApprovalService();
    approvalService.getStatus.mockResolvedValue('approved');
    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');

    new TelegramBot(
      new MockEnvService() as any,
      memories as any,
      new DummyAdmin() as any,
      approvalService as any,
      new DummyExtractor() as any,
      new DummyPipeline() as any,
      new DummyResponder() as any
    );

    const call = actionSpy.mock.calls.find(
      ([pattern]) =>
        pattern instanceof RegExp && pattern.source === '^admin_chat:(\\S+)$'
    );
    actionSpy.mockRestore();
    const handler = call![1];

    const ctx: any = {
      chat: { id: 1 },
      match: ['admin_chat:42', '42'],
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
    };

    await handler(ctx);

    expect(approvalService.getStatus).toHaveBeenCalledWith(42);
    expect(ctx.reply).toHaveBeenCalledWith('Статус чата 42: approved', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Забанить', callback_data: 'chat_ban:42' }]],
      },
    });
  });

  it('chat_ban updates message', async () => {
    const memories = new MockChatMemoryManager();
    const approvalService = new DummyApprovalService();
    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');

    new TelegramBot(
      new MockEnvService() as any,
      memories as any,
      new DummyAdmin() as any,
      approvalService as any,
      new DummyExtractor() as any,
      new DummyPipeline() as any,
      new DummyResponder() as any
    );

    const call = actionSpy.mock.calls.find(
      ([pattern]) =>
        pattern instanceof RegExp && pattern.source === '^chat_ban:(\\S+)$'
    );
    actionSpy.mockRestore();
    const handler = call![1];

    const ctx: any = {
      chat: { id: 1 },
      match: ['chat_ban:7', '7'],
      telegram: { sendMessage: vi.fn() },
      answerCbQuery: vi.fn(),
      editMessageText: vi.fn(),
    };

    await handler(ctx);

    expect(approvalService.ban).toHaveBeenCalledWith(7);
    expect(ctx.editMessageText).toHaveBeenCalledWith('Чат 7 забанен', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Разбанить', callback_data: 'chat_unban:7' }],
        ],
      },
    });
  });
});

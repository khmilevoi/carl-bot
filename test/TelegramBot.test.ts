import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { TelegramBot } from '../src/bot/TelegramBot';
import type { ChatRepository } from '../src/repositories/interfaces/ChatRepository.interface';
import type { AdminService } from '../src/services/admin/AdminService.interface';
import type { ChatApprovalService } from '../src/services/chat/ChatApprovalService';
import type { ChatMemoryManager } from '../src/services/chat/ChatMemory';
import type { ChatResponder } from '../src/services/chat/ChatResponder';
import type { TriggerPipeline } from '../src/services/chat/TriggerPipeline';
import type { EnvService } from '../src/services/env/EnvService';
import type { MessageContextExtractor } from '../src/services/messages/MessageContextExtractor';

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
  extract() {
    return {};
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

    const ctx = { reply: vi.fn() } as unknown as Context;

    await (
      bot as unknown as { showAdminChatsMenu: (ctx: Context) => Promise<void> }
    ).showAdminChatsMenu(ctx);

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

    new TelegramBot(
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
    const handler = call![1];

    const ctx = {
      chat: { id: 1 },
      match: ['admin_chat:42', '42'],
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
    } as unknown as Context;

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
    const handler = call![1];

    const ctx = {
      chat: { id: 1 },
      match: ['chat_ban:7', '7'],
      telegram: { sendMessage: vi.fn() },
      answerCbQuery: vi.fn(),
      editMessageText: vi.fn(),
    } as unknown as Context;

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

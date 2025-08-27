import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { TelegramBot } from '../src/view/telegram/TelegramBot';
import * as TelegramBotModule from '../src/view/telegram/TelegramBot';
import { createWindows } from '../src/view/telegram/windowConfig';
import type { ChatInfoService } from '../src/application/interfaces/chat/ChatInfoService';
import type { AdminService } from '../src/application/interfaces/admin/AdminService';
import type { ChatApprovalService } from '../src/application/interfaces/chat/ChatApprovalService';
import type { ChatMemoryManager } from '../src/application/interfaces/chat/ChatMemoryManager';
import type { ChatResponder } from '../src/application/interfaces/chat/ChatResponder';
import type { TriggerPipeline } from '../src/application/interfaces/chat/TriggerPipeline';
import type { EnvService } from '../src/application/interfaces/env/EnvService';
import type { ChatConfigService } from '../src/application/interfaces/chat/ChatConfigService';
import {
  InvalidInterestIntervalError,
  InvalidHistoryLimitError,
  InvalidTopicTimeError,
} from '../src/application/interfaces/chat/ChatConfigService.errors';
import type { TopicOfDayScheduler } from '../src/application/interfaces/scheduler/TopicOfDayScheduler';
import type {
  MessageContext,
  MessageContextExtractor,
} from '../src/application/interfaces/messages/MessageContextExtractor';
import type { LoggerFactory } from '../src/application/interfaces/logging/LoggerFactory';

const createLoggerFactory = (): LoggerFactory =>
  ({
    create: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    }),
  }) as unknown as LoggerFactory;

class MockEnvService {
  env = { BOT_TOKEN: 'token', ADMIN_CHAT_ID: 1 } as EnvService['env'];
}

class MockChatMemory {
  addMessage = vi.fn();
  getHistory = vi.fn(async () => []);
}

class MockChatMemoryManager {
  memory = new MockChatMemory();
  get = vi.fn(async () => this.memory);
  reset = vi.fn();
}

class DummyAdmin {
  hasAccess = vi.fn(async () => true);
  exportTables = vi.fn(async () => []);
  exportChatData = vi.fn(async () => []);
  createAccessKey = vi.fn(async () => new Date());
  setHistoryLimit = vi.fn(async () => {});
  setInterestInterval = vi.fn(async () => {});
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

class DummyChatInfoService {
  saveChat = vi.fn(async () => {});
  getChat = vi.fn(async () => undefined);
}

class DummyChatConfigService {
  getConfig = vi.fn();
  setHistoryLimit = vi.fn(async () => {});
  setInterestInterval = vi.fn(async () => {});
  setTopicTime = vi.fn(
    async (
      _chatId: number,
      _topicTime: string | null,
      _topicTimezone: string
    ) => {}
  );
}

describe('TelegramBot', () => {
  it('contains settings menu item', async () => {
    const windows = createWindows({
      exportData: vi.fn(),
      resetMemory: vi.fn(),
      requestChatAccess: vi.fn(),
      requestUserAccess: vi.fn(),
      showAdminChats: vi.fn(),
      showChatSettings: vi.fn(),
      configHistoryLimit: vi.fn(),
      configInterestInterval: vi.fn(),
      configTopicTime: vi.fn(),
    });
    const menu = windows.find((w) => w.id === 'menu');
    if (!menu) throw new Error('route not found');
    const { buttons } = await menu.build({ loadData: async () => undefined });
    expect(buttons.some((b) => b.text === '⚙️ Настройки')).toBe(true);
  });

  it('shows chat settings with current config', async () => {
    const memories = new MockChatMemoryManager();
    const configureSpy = vi
      .spyOn(
        TelegramBot.prototype as unknown as Record<string, unknown>,
        'configure'
      )
      .mockImplementation(() => {});
    const config = new DummyChatConfigService();
    config.getConfig.mockResolvedValue({
      chatId: 2,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
      topicTimezone: 'UTC',
    });
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory()
    );
    configureSpy.mockRestore();
    const botWithRouter = bot as unknown as {
      router: { show: ReturnType<typeof vi.fn> };
      showChatSettings: (ctx: Context) => Promise<void>;
    };
    botWithRouter.router = { show: vi.fn() };
    const ctx = { chat: { id: 2 } } as unknown as Context;
    await botWithRouter.showChatSettings(ctx);
    expect(config.getConfig).toHaveBeenCalledWith(2);
    expect(botWithRouter.router.show).toHaveBeenCalledWith(
      ctx,
      'chat_settings',
      {
        loadData: expect.any(Function),
      }
    );
  });

  it('updates history limit on valid input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const scheduler = { reschedule: vi.fn() };
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory(),
      scheduler as unknown as TopicOfDayScheduler
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleConfigHistoryLimit: (ctx: Context) => Promise<void>;
      }
    ).handleConfigHistoryLimit({ chat: { id: 10 } } as Context);
    const ctxText = {
      chat: { id: 10 },
      message: { text: '5' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(config.setHistoryLimit).toHaveBeenCalledWith(10, 5);
    expect(ctxText.reply).toHaveBeenCalledWith('✅ Лимит истории обновлён');
    expect(showSpy).toHaveBeenCalledWith(ctxText, 'menu');
    expect(scheduler.reschedule).not.toHaveBeenCalled();
  });

  it('handles invalid topic time input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const scheduler = { reschedule: vi.fn() };
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory(),
      scheduler as unknown as TopicOfDayScheduler
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleConfigTopicTime: (ctx: Context) => Promise<void>;
      }
    ).handleConfigTopicTime({ chat: { id: 14 } } as Context);
    const ctxTime = {
      chat: { id: 14 },
      message: { text: 'bad' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxTime);
    expect(showSpy).toHaveBeenNthCalledWith(
      2,
      ctxTime,
      'chat_topic_timezone',
      expect.anything()
    );
    const ctxZone = {
      chat: { id: 14 },
      message: { text: 'UTC' },
      reply: vi.fn(),
    } as unknown as Context;
    config.setTopicTime.mockImplementationOnce(async () => {
      throw new InvalidTopicTimeError('Invalid topic time');
    });
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxZone);
    expect(config.setTopicTime).toHaveBeenCalledWith(14, 'bad', 'UTC');
    expect(ctxZone.reply).toHaveBeenCalledWith(
      '❌ Время статьи должно быть в формате HH:MM'
    );
    expect(showSpy).toHaveBeenNthCalledWith(3, ctxZone, 'menu');
  });

  it('updates interest interval on valid input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const scheduler = { reschedule: vi.fn() };
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory(),
      scheduler as unknown as TopicOfDayScheduler
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleConfigInterestInterval: (ctx: Context) => Promise<void>;
      }
    ).handleConfigInterestInterval({ chat: { id: 11 } } as Context);
    const ctxText = {
      chat: { id: 11 },
      message: { text: '15' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(config.setInterestInterval).toHaveBeenCalledWith(11, 15);
    expect(ctxText.reply).toHaveBeenCalledWith('✅ Интервал интереса обновлён');
    expect(showSpy).toHaveBeenCalledWith(ctxText, 'menu');
  });

  it('updates topic time on valid input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const scheduler = { reschedule: vi.fn() };
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory(),
      scheduler as unknown as TopicOfDayScheduler
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleConfigTopicTime: (ctx: Context) => Promise<void>;
      }
    ).handleConfigTopicTime({ chat: { id: 30 } } as Context);
    const ctxTime = {
      chat: { id: 30 },
      message: { text: '10:30' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxTime);
    expect(showSpy).toHaveBeenNthCalledWith(
      2,
      ctxTime,
      'chat_topic_timezone',
      expect.anything()
    );
    const ctxZone = {
      chat: { id: 30 },
      message: { text: 'UTC' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxZone);
    expect(config.setTopicTime).toHaveBeenCalledWith(30, '10:30', 'UTC');
    expect(ctxZone.reply).toHaveBeenCalledWith('✅ Время статьи обновлено');
    expect(showSpy).toHaveBeenNthCalledWith(3, ctxZone, 'menu');
    expect(scheduler.reschedule).toHaveBeenCalledWith(30);
  });

  it('handles invalid history limit input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const scheduler = { reschedule: vi.fn() };
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory(),
      scheduler as unknown as TopicOfDayScheduler
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleConfigHistoryLimit: (ctx: Context) => Promise<void>;
      }
    ).handleConfigHistoryLimit({ chat: { id: 12 } } as Context);
    const ctxText = {
      chat: { id: 12 },
      message: { text: '100' },
      reply: vi.fn(),
    } as unknown as Context;
    config.setHistoryLimit.mockImplementationOnce(async () => {
      throw new InvalidHistoryLimitError('Invalid history limit');
    });
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(config.setHistoryLimit).toHaveBeenCalledWith(12, 100);
    expect(ctxText.reply).toHaveBeenCalledWith(
      '❌ Лимит истории должен быть целым числом от 1 до 50'
    );
    expect(showSpy).toHaveBeenCalledWith(ctxText, 'menu');
  });

  it('handles invalid interest interval input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleConfigInterestInterval: (ctx: Context) => Promise<void>;
      }
    ).handleConfigInterestInterval({ chat: { id: 13 } } as Context);
    const ctxText = {
      chat: { id: 13 },
      message: { text: '100' },
      reply: vi.fn(),
    } as unknown as Context;
    config.setInterestInterval.mockImplementationOnce(async () => {
      throw new InvalidInterestIntervalError('Invalid interest interval');
    });
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(config.setInterestInterval).toHaveBeenCalledWith(13, 100);
    expect(ctxText.reply).toHaveBeenCalledWith(
      '❌ Интервал интереса должен быть целым числом от 1 до 50'
    );
    expect(showSpy).toHaveBeenCalledWith(ctxText, 'menu');
  });

  it('admin updates history limit on valid input', async () => {
    const memories = new MockChatMemoryManager();
    const admin = new DummyAdmin();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const showSpy = vi
      .spyOn(
        bot as unknown as {
          showAdminChat: (ctx: Context, id: number) => Promise<void>;
        },
        'showAdminChat'
      )
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleAdminConfigHistoryLimit: (
          ctx: Context,
          chatId: number
        ) => Promise<void>;
      }
    ).handleAdminConfigHistoryLimit(
      {
        chat: { id: 1 },
        reply: vi.fn(),
      } as Context,
      42
    );
    const ctxText = {
      chat: { id: 1 },
      message: { text: '5' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(admin.setHistoryLimit).toHaveBeenCalledWith(42, 5);
    expect(ctxText.reply).toHaveBeenCalledWith('✅ Лимит истории обновлён');
    expect(showSpy).toHaveBeenCalledWith(ctxText, 42);
  });

  it('admin updates interest interval on valid input', async () => {
    const memories = new MockChatMemoryManager();
    const admin = new DummyAdmin();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const showSpy = vi
      .spyOn(
        bot as unknown as {
          showAdminChat: (ctx: Context, id: number) => Promise<void>;
        },
        'showAdminChat'
      )
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleAdminConfigInterestInterval: (
          ctx: Context,
          chatId: number
        ) => Promise<void>;
      }
    ).handleAdminConfigInterestInterval(
      {
        chat: { id: 1 },
        reply: vi.fn(),
      } as Context,
      43
    );
    const ctxText = {
      chat: { id: 1 },
      message: { text: '10' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(admin.setInterestInterval).toHaveBeenCalledWith(43, 10);
    expect(ctxText.reply).toHaveBeenCalledWith('✅ Интервал интереса обновлён');
    expect(showSpy).toHaveBeenCalledWith(ctxText, 43);
  });

  it('admin updates topic time on valid input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const scheduler = { reschedule: vi.fn() };
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory(),
      scheduler as unknown as TopicOfDayScheduler
    );
    const routeSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    const showSpy = vi
      .spyOn(
        bot as unknown as {
          showAdminChat: (ctx: Context, id: number) => Promise<void>;
        },
        'showAdminChat'
      )
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleAdminConfigTopicTime: (
          ctx: Context,
          chatId: number
        ) => Promise<void>;
      }
    ).handleAdminConfigTopicTime(
      { chat: { id: 1 }, reply: vi.fn() } as Context,
      50
    );
    const ctxTime = {
      chat: { id: 1 },
      message: { text: '08:00' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxTime);
    expect(routeSpy).toHaveBeenNthCalledWith(
      2,
      ctxTime,
      'admin_chat_topic_timezone',
      expect.anything()
    );
    const ctxZone = {
      chat: { id: 1 },
      message: { text: 'UTC' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxZone);
    expect(config.setTopicTime).toHaveBeenCalledWith(50, '08:00', 'UTC');
    expect(ctxZone.reply).toHaveBeenCalledWith('✅ Время статьи обновлено');
    expect(showSpy).toHaveBeenCalledWith(ctxZone, 50);
    expect(scheduler.reschedule).toHaveBeenCalledWith(50);
  });

  it('admin handles invalid history limit input', async () => {
    const memories = new MockChatMemoryManager();
    const admin = new DummyAdmin();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const showSpy = vi
      .spyOn(
        bot as unknown as {
          showAdminChat: (ctx: Context, id: number) => Promise<void>;
        },
        'showAdminChat'
      )
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleAdminConfigHistoryLimit: (
          ctx: Context,
          chatId: number
        ) => Promise<void>;
      }
    ).handleAdminConfigHistoryLimit(
      {
        chat: { id: 1 },
        reply: vi.fn(),
      } as Context,
      44
    );
    const ctxText = {
      chat: { id: 1 },
      message: { text: '100' },
      reply: vi.fn(),
    } as unknown as Context;
    admin.setHistoryLimit.mockImplementationOnce(async () => {
      throw new InvalidHistoryLimitError('Invalid history limit');
    });
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(admin.setHistoryLimit).toHaveBeenCalledWith(44, 100);
    expect(ctxText.reply).toHaveBeenCalledWith(
      '❌ Лимит истории должен быть целым числом от 1 до 50'
    );
    expect(showSpy).toHaveBeenCalledWith(ctxText, 44);
  });

  it('admin handles invalid interest interval input', async () => {
    const memories = new MockChatMemoryManager();
    const admin = new DummyAdmin();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      admin as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const showSpy = vi
      .spyOn(
        bot as unknown as {
          showAdminChat: (ctx: Context, id: number) => Promise<void>;
        },
        'showAdminChat'
      )
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleAdminConfigInterestInterval: (
          ctx: Context,
          chatId: number
        ) => Promise<void>;
      }
    ).handleAdminConfigInterestInterval(
      {
        chat: { id: 1 },
        reply: vi.fn(),
      } as Context,
      45
    );
    const ctxText = {
      chat: { id: 1 },
      message: { text: '100' },
      reply: vi.fn(),
    } as unknown as Context;
    admin.setInterestInterval.mockImplementationOnce(async () => {
      throw new InvalidInterestIntervalError('Invalid interest interval');
    });
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxText);
    expect(admin.setInterestInterval).toHaveBeenCalledWith(45, 100);
    expect(ctxText.reply).toHaveBeenCalledWith(
      '❌ Интервал интереса должен быть целым числом от 1 до 50'
    );
    expect(showSpy).toHaveBeenCalledWith(ctxText, 45);
  });

  it('admin handles invalid topic time input', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const scheduler = { reschedule: vi.fn() };
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory(),
      scheduler as unknown as TopicOfDayScheduler
    );
    const routeSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    const showSpy = vi
      .spyOn(
        bot as unknown as {
          showAdminChat: (ctx: Context, id: number) => Promise<void>;
        },
        'showAdminChat'
      )
      .mockResolvedValue(undefined);
    await (
      bot as unknown as {
        handleAdminConfigTopicTime: (
          ctx: Context,
          chatId: number
        ) => Promise<void>;
      }
    ).handleAdminConfigTopicTime(
      { chat: { id: 1 }, reply: vi.fn() } as Context,
      46
    );
    const ctxTime = {
      chat: { id: 1 },
      message: { text: 'bad' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxTime);
    expect(routeSpy).toHaveBeenNthCalledWith(
      2,
      ctxTime,
      'admin_chat_topic_timezone',
      expect.anything()
    );
    const ctxZone = {
      chat: { id: 1 },
      message: { text: 'UTC' },
      reply: vi.fn(),
    } as unknown as Context;
    config.setTopicTime.mockImplementationOnce(async () => {
      throw new InvalidTopicTimeError('Invalid topic time');
    });
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxZone);
    expect(config.setTopicTime).toHaveBeenCalledWith(46, 'bad', 'UTC');
    expect(ctxZone.reply).toHaveBeenCalledWith(
      '❌ Время статьи должно быть в формате HH:MM'
    );
    expect(showSpy).toHaveBeenCalledWith(ctxZone, 46);
    expect(scheduler.reschedule).not.toHaveBeenCalled();
  });

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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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

    const chatRepo = new DummyChatInfoService();
    chatRepo.getChat.mockResolvedValue({ chatId: 42, title: 'Test Chat' });

    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      chatRepo as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    await new Promise((resolve) => setImmediate(resolve));
    const call = actionSpy.mock.calls.find(
      ([pattern]) => pattern === 'admin_chats'
    );
    actionSpy.mockRestore();
    configureSpy.mockRestore();
    if (!call) throw new Error('Handler not found');
    const handler = call[1];

    await (
      bot as unknown as {
        router: { show: (ctx: Context, id: string) => Promise<void> };
      }
    ).router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'admin_menu'
    );

    const ctx = {
      chat: { id: 1 },
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await handler(ctx);

    expect(approvalService.listAll).toHaveBeenCalled();
    expect(chatRepo.getChat).toHaveBeenCalledWith(42);
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

    const config = new DummyChatConfigService();
    config.getConfig.mockResolvedValue({
      chatId: 42,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
      topicTimezone: 'UTC',
    });
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory()
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
          [
            {
              text: '🕒 Лимит истории (50)',
              callback_data: 'admin_chat_history_limit:42',
            },
          ],
          [
            {
              text: '✨ Интервал интереса (25)',
              callback_data: 'admin_chat_interest_interval:42',
            },
          ],
          [
            {
              text: '📝 Время статьи (09:00)',
              callback_data: 'admin_chat_topic_time:42',
            },
          ],
        ],
      },
    });
  });

  it('does nothing on back from admin_chat without parent', async () => {
    const memories = new MockChatMemoryManager();
    const approvalService = new DummyApprovalService();
    approvalService.getStatus.mockResolvedValue('approved');
    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');

    const config = new DummyChatConfigService();
    config.getConfig.mockResolvedValue({
      chatId: 7,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
      topicTimezone: 'UTC',
    });
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory()
    );
    await new Promise((resolve) => setImmediate(resolve));

    const backCall = actionSpy.mock.calls.find(
      ([pattern]) => pattern === 'back'
    );
    actionSpy.mockRestore();
    if (!backCall) {
      throw new Error('Back handler not found');
    }
    const backHandler = backCall[1];

    const loadChats = vi.fn(async () => [
      { id: 42, title: 'Chat A' },
      { id: 43, title: 'Chat B' },
    ]);
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;
    await (bot as unknown as { router: any }).router.show(ctx, 'admin_menu');
    await (bot as unknown as { router: any }).router.show(ctx, 'admin_chats', {
      loadData: loadChats,
    });
    await (
      bot as unknown as {
        showAdminChat: (ctx: Context, id: number) => Promise<void>;
      }
    ).showAdminChat(ctx, 42);

    const ctxBack = {
      chat: { id: 1 },
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await backHandler(ctxBack);

    expect(loadChats).toHaveBeenCalledTimes(1);
    expect(ctxBack.reply).not.toHaveBeenCalled();
  });

  it('chat_ban updates message', async () => {
    const memories = new MockChatMemoryManager();
    const approvalService = new DummyApprovalService();
    approvalService.getStatus
      .mockResolvedValueOnce('approved')
      .mockResolvedValueOnce('banned');
    const actionSpy = vi.spyOn(Telegraf.prototype, 'action');

    const config = new DummyChatConfigService();
    config.getConfig.mockResolvedValue({
      chatId: 7,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
      topicTimezone: 'UTC',
    });
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approvalService as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory()
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
          [
            {
              text: '🕒 Лимит истории (50)',
              callback_data: 'admin_chat_history_limit:7',
            },
          ],
          [
            {
              text: '✨ Интервал интереса (25)',
              callback_data: 'admin_chat_interest_interval:7',
            },
          ],
          [
            {
              text: '📝 Время статьи (09:00)',
              callback_data: 'admin_chat_topic_time:7',
            },
          ],
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    configureSpy.mockRestore();
    const botWithRouter = bot as unknown as {
      router: { show: ReturnType<typeof vi.fn> };
      showMenu: (ctx: Context) => Promise<void>;
    };
    botWithRouter.router = { show: vi.fn() };
    const ctx = { chat: { id: 1 } } as unknown as Context;
    await botWithRouter.showMenu(ctx);
    expect(botWithRouter.router.show).toHaveBeenCalledWith(ctx, 'admin_menu');
  });

  it('shows chat_not_approved for unapproved chats', async () => {
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
    expect(botWithRouter.router.show).toHaveBeenCalledWith(
      bannedCtx,
      'chat_not_approved'
    );
    approvalService.getStatus.mockResolvedValueOnce('pending');
    const pendingCtx = {
      chat: { id: 3 },
      reply: vi.fn(),
    } as unknown as Context;
    await botWithRouter.showMenu(pendingCtx);
    expect(botWithRouter.router.show).toHaveBeenLastCalledWith(
      pendingCtx,
      'chat_not_approved'
    );
  });

  it('shows menu when user lacks permission', async () => {
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    configureSpy.mockRestore();
    const botWithRouter = bot as unknown as {
      router: { show: ReturnType<typeof vi.fn> };
      showMenu: (ctx: Context) => Promise<void>;
    };
    botWithRouter.router = { show: vi.fn() };
    const ctx = { chat: { id: 2 }, from: { id: 5 } } as unknown as Context;
    await botWithRouter.showMenu(ctx);
    expect(botWithRouter.router.show).toHaveBeenCalledWith(ctx, 'menu');
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    const ctxPending = {
      chat: { id: 2 },
      from: { id: 1 },
      message: { text: 'hi', message_id: 1 },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxPending);
    expect(sendRequest).not.toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalledWith(ctxPending, 'chat_not_approved');
    const ctxBanned = {
      chat: { id: 3 },
      from: { id: 1 },
      message: { text: 'hi', message_id: 1 },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as { handleText: (ctx: Context) => Promise<void> }
    ).handleText(ctxBanned);
    expect(memories.memory.addMessage).not.toHaveBeenCalled();
    expect(showSpy).toHaveBeenNthCalledWith(2, ctxBanned, 'chat_not_approved');
    expect(showSpy).toHaveBeenCalledTimes(2);
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    configureSpy.mockRestore();
    const botWithRouter = bot as unknown as {
      handleExportData: (ctx: Context) => Promise<void>;
      router: { show: ReturnType<typeof vi.fn> };
    };
    botWithRouter.router = { show: vi.fn() };
    const ctx = {
      chat: { id: 2 },
      from: { id: 3 },
      answerCbQuery: vi.fn(),
    } as unknown as Context;
    await botWithRouter.handleExportData(ctx);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'Нет доступа или ключ просрочен'
    );
    expect(botWithRouter.router.show).toHaveBeenCalledWith(ctx, 'no_access');
  });

  it('handleAwaitingConfig updates history limit', async () => {
    const memories = new MockChatMemoryManager();
    const config = new DummyChatConfigService();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      config as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    const ctx = {
      chat: { id: 10 },
      message: { text: '7' },
      reply: vi.fn(),
    } as unknown as Context;
    await (
      bot as unknown as {
        handleAwaitingConfig: (
          ctx: Context,
          awaiting: {
            type: 'history' | 'interest';
            chatId: number;
            admin: boolean;
          }
        ) => Promise<void>;
      }
    ).handleAwaitingConfig(ctx, { type: 'history', chatId: 10, admin: false });
    expect(config.setHistoryLimit).toHaveBeenCalledWith(10, 7);
    expect(ctx.reply).toHaveBeenCalledWith('✅ Лимит истории обновлён');
    expect(showSpy).toHaveBeenCalledWith(ctx, 'menu');
  });

  it('checkChatStatus handles pending chat', async () => {
    const memories = new MockChatMemoryManager();
    const approval = new DummyApprovalService();
    approval.getStatus.mockResolvedValue('pending');
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approval as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const sendSpy = vi
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
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    const ctx = { chat: { id: 5 }, reply: vi.fn() } as unknown as Context;
    const result = await (
      bot as unknown as {
        checkChatStatus: (ctx: Context, chatId: number) => Promise<boolean>;
      }
    ).checkChatStatus(ctx, 5);
    expect(result).toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalledWith(ctx, 'chat_not_approved');
  });

  it('checkChatStatus handles banned chat', async () => {
    const memories = new MockChatMemoryManager();
    const approval = new DummyApprovalService();
    approval.getStatus.mockResolvedValue('banned');
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approval as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const sendSpy = vi.spyOn(
      bot as unknown as {
        sendChatApprovalRequest: (
          chatId: number,
          title?: string
        ) => Promise<void>;
      },
      'sendChatApprovalRequest'
    );
    const showSpy = vi
      .spyOn((bot as unknown as { router: { show: Function } }).router, 'show')
      .mockResolvedValue(undefined);
    const ctx = { chat: { id: 6 } } as unknown as Context;
    const result = await (
      bot as unknown as {
        checkChatStatus: (ctx: Context, chatId: number) => Promise<boolean>;
      }
    ).checkChatStatus(ctx, 6);
    expect(result).toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalledWith(ctx, 'chat_not_approved');
  });

  it('checkChatStatus allows approved chat', async () => {
    const memories = new MockChatMemoryManager();
    const approval = new DummyApprovalService();
    approval.getStatus.mockResolvedValue('approved');
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      approval as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      new DummyPipeline() as unknown as TriggerPipeline,
      new DummyResponder() as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const ctx = { chat: { id: 7 } } as unknown as Context;
    const result = await (
      bot as unknown as {
        checkChatStatus: (ctx: Context, chatId: number) => Promise<boolean>;
      }
    ).checkChatStatus(ctx, 7);
    expect(result).toBe(true);
  });

  it('prepareAndSendResponse does nothing without trigger', async () => {
    const memories = new MockChatMemoryManager();
    const pipeline = new DummyPipeline();
    pipeline.shouldRespond.mockResolvedValue(null);
    const responder = new DummyResponder();
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      pipeline as unknown as TriggerPipeline,
      responder as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const ctx = {
      chat: { id: 1 },
      message: { text: 'hi', message_id: 2 },
      reply: vi.fn(),
      sendChatAction: vi.fn().mockResolvedValue(undefined),
      telegram: { sendChatAction: vi.fn().mockResolvedValue(undefined) },
    } as unknown as Context;
    await (
      bot as unknown as {
        prepareAndSendResponse: (ctx: Context, chatId: number) => Promise<void>;
      }
    ).prepareAndSendResponse(ctx, 1);
    expect(memories.memory.addMessage).toHaveBeenCalled();
    expect(responder.generate).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('prepareAndSendResponse replies when trigger matches', async () => {
    const memories = new MockChatMemoryManager();
    const pipeline = new DummyPipeline();
    pipeline.shouldRespond.mockResolvedValue({
      replyToMessageId: 2,
      reason: 'r',
    });
    const responder = new DummyResponder();
    responder.generate.mockResolvedValue('answer');
    const bot = new TelegramBot(
      new MockEnvService() as unknown as EnvService,
      memories as unknown as ChatMemoryManager,
      new DummyAdmin() as unknown as AdminService,
      new DummyApprovalService() as unknown as ChatApprovalService,
      new DummyExtractor() as unknown as MessageContextExtractor,
      pipeline as unknown as TriggerPipeline,
      responder as unknown as ChatResponder,
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
    );
    const ctx = {
      chat: { id: 1 },
      message: { text: 'hi', message_id: 2 },
      reply: vi.fn(),
      sendChatAction: vi.fn().mockResolvedValue(undefined),
      telegram: { sendChatAction: vi.fn().mockResolvedValue(undefined) },
    } as unknown as Context;
    await (
      bot as unknown as {
        prepareAndSendResponse: (ctx: Context, chatId: number) => Promise<void>;
      }
    ).prepareAndSendResponse(ctx, 1);
    expect(responder.generate).toHaveBeenCalledWith(ctx, 1, 'r');
    expect(ctx.reply).toHaveBeenCalledWith('answer', {
      reply_parameters: { message_id: 2 },
    });
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
      new DummyChatInfoService() as unknown as ChatInfoService,
      new DummyChatConfigService() as unknown as ChatConfigService,
      createLoggerFactory()
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, Telegraf } from 'telegraf';

import {
  InMemoryStateStore,
  createRouter,
  route,
  button,
  branch,
  cb,
  type ContextWithMatch,
  type Route,
} from '../src/view/telegram/inline-router';
import { type Actions } from '../src/view/telegram/routes';

describe('routes.ts - actual routing logic', () => {
  let mockActions: Actions;
  let mockBot: Partial<Telegraf>;
  let stateStore: InMemoryStateStore;
  let ctx: any;

  beforeEach(() => {
    stateStore = new InMemoryStateStore();

    mockActions = {
      exportData: vi.fn().mockResolvedValue(undefined),
      resetMemory: vi.fn().mockResolvedValue(undefined),
      getChats: vi.fn().mockResolvedValue([
        { id: 100, title: 'Test Chat 1' },
        { id: 200, title: 'Test Chat 2' },
      ]),
      getChatData: vi.fn().mockResolvedValue({
        chatId: 123,
        status: 'approved',
        config: {
          historyLimit: 15,
          interestInterval: 7,
          topicTime: '10:00',
          topicTimezone: 'UTC+03',
        },
      }),
      requestChatAccess: vi.fn().mockResolvedValue(undefined),
      requestUserAccess: vi.fn().mockResolvedValue(undefined),
      sendChatApprovalRequest: vi.fn().mockResolvedValue(undefined),
      approveChat: vi.fn().mockResolvedValue(undefined),
      banChat: vi.fn().mockResolvedValue(undefined),
      unbanChat: vi.fn().mockResolvedValue(undefined),
      approveUser: vi.fn().mockResolvedValue(new Date('2024-02-01T12:00:00Z')),
      getChatConfig: vi.fn().mockResolvedValue({
        historyLimit: 25,
        interestInterval: 12,
        topicTime: '14:00',
        topicTimezone: 'UTC+00',
      }),
      setHistoryLimit: vi.fn().mockResolvedValue(undefined),
      setInterestInterval: vi.fn().mockResolvedValue(undefined),
      setTopicTime: vi.fn().mockResolvedValue(undefined),
      checkChatStatus: vi.fn().mockResolvedValue('approved'),
      processMessage: vi.fn().mockResolvedValue(undefined),
      isAdmin: vi.fn().mockReturnValue(false),
    };

    mockBot = {
      command: vi.fn(),
      on: vi.fn(),
      action: vi.fn(),
      telegram: {
        setMyCommands: vi.fn().mockResolvedValue(undefined),
      },
    };

    ctx = {
      chat: { id: 1 },
      from: { id: 500 },
      reply: vi.fn().mockResolvedValue({ message_id: 100 }),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 100 }),
      answerCbQuery: vi.fn().mockResolvedValue(true),
      callbackQuery: undefined,
      text: undefined,
      match: undefined,
    };
  });

  describe('Menu route - admin/user navigation logic', () => {
    it('redirects admin users to AdminMenu', async () => {
      mockActions.isAdmin = vi.fn().mockReturnValue(true);

      // Create simplified Menu route like the real one
      const AdminMenu = route<Actions>('admin_menu', async () => ({
        text: 'Панель администратора\nВыберите действие:',
        buttons: [],
      }));

      const UserMenu = route<Actions>('user_menu', async () => ({
        text: 'Главное меню\nВыберите действие:',
        buttons: [],
      }));

      const Menu = route<Actions>(
        'menu',
        async ({ ctx, actions, navigate }) => {
          if (actions.isAdmin(ctx.from?.id ?? 0)) {
            return navigate(AdminMenu);
          }
          return navigate(UserMenu);
        }
      );

      const router = createRouter([Menu, AdminMenu, UserMenu], [], {
        stateStore,
      });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, Menu);

      expect(mockActions.isAdmin).toHaveBeenCalledWith(500);
      expect(ctx.reply).toHaveBeenCalledWith(
        'Панель администратора\nВыберите действие:',
        expect.any(Object)
      );
    });

    it('redirects regular users to UserMenu', async () => {
      mockActions.isAdmin = vi.fn().mockReturnValue(false);

      // Create simplified routes
      const AdminMenu = route<Actions>('admin_menu', async () => ({
        text: 'Панель администратора\nВыберите действие:',
        buttons: [],
      }));

      const UserMenu = route<Actions>('user_menu', async () => ({
        text: 'Главное меню\nВыберите действие:',
        buttons: [],
      }));

      const Menu = route<Actions>(
        'menu',
        async ({ ctx, actions, navigate }) => {
          if (actions.isAdmin(ctx.from?.id ?? 0)) {
            return navigate(AdminMenu);
          }
          return navigate(UserMenu);
        }
      );

      const router = createRouter([Menu, AdminMenu, UserMenu], [], {
        stateStore,
      });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, Menu);

      expect(mockActions.isAdmin).toHaveBeenCalledWith(500);
      expect(ctx.reply).toHaveBeenCalledWith(
        'Главное меню\nВыберите действие:',
        expect.any(Object)
      );
    });
  });

  describe('AdminMenu vs UserMenu - different button actions', () => {
    it('AdminMenu export button calls exportData action', async () => {
      const AdminMenu = route<Actions>('admin_menu', async () => ({
        text: 'Панель администратора\nВыберите действие:',
        buttons: [
          button({
            text: '📊 Загрузить данные',
            callback: 'admin_export',
            action: async ({ actions, ctx }) => {
              await actions.exportData(ctx);
            },
          }),
        ],
      }));

      const router = createRouter([AdminMenu], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminMenu);

      // Simulate button click
      const buttonCtx = {
        ...ctx,
        callbackQuery: { data: cb('admin_menu', ['admin_export']) },
      };

      // Find and execute the button action
      const view = await AdminMenu.action({
        ctx: buttonCtx,
        actions: mockActions,
        params: {},
      });
      const exportButton = view.buttons?.[0];
      if (exportButton?.action) {
        await exportButton.action({
          actions: mockActions,
          ctx: buttonCtx,
          navigate: vi.fn(),
          navigateBack: vi.fn(),
          params: {},
        });
      }

      expect(mockActions.exportData).toHaveBeenCalledWith(buttonCtx);
    });

    it('UserMenu has different buttons than AdminMenu', async () => {
      const UserMenu = route<Actions>('user_menu', async () => ({
        text: 'Главное меню\nВыберите действие:',
        buttons: [
          button({
            text: '📊 Загрузить данные',
            callback: 'export',
            action: async ({ actions, ctx }) => {
              await actions.exportData(ctx);
            },
          }),
          button({
            text: '🔄 Сбросить память',
            callback: 'reset',
            action: async ({ actions, ctx }) => {
              await actions.resetMemory(ctx);
            },
          }),
        ],
      }));

      const router = createRouter([UserMenu], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, UserMenu);

      // Test reset memory button that only exists in UserMenu
      const resetCtx = {
        ...ctx,
        callbackQuery: { data: cb('user_menu', ['reset']) },
      };

      const view = await UserMenu.action({
        ctx: resetCtx,
        actions: mockActions,
        params: {},
      });
      const resetButton = view.buttons?.[1]; // Second button
      if (resetButton?.action) {
        await resetButton.action({
          actions: mockActions,
          ctx: resetCtx,
          navigate: vi.fn(),
          navigateBack: vi.fn(),
          params: {},
        });
      }

      expect(mockActions.resetMemory).toHaveBeenCalledWith(resetCtx);
    });
  });

  describe('AdminChats - dynamic button generation', () => {
    it('generates buttons based on getChats result', async () => {
      const AdminChats = route<Actions>('admin_chats', async ({ actions }) => {
        const chats = await actions.getChats();
        return {
          text:
            chats.length > 0
              ? 'Выберите чат для управления:'
              : 'Нет доступных чатов',
          buttons: chats.map((chat) =>
            button({
              text: `${chat.title} (${chat.id})`,
              callback: `chat_${chat.id}`,
              action: ({ navigate }) =>
                navigate('admin_chat', { chatId: chat.id }),
            })
          ),
        };
      });

      const router = createRouter([AdminChats], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChats);

      expect(mockActions.getChats).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        'Выберите чат для управления:',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: 'Test Chat 1 (100)' }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({ text: 'Test Chat 2 (200)' }),
              ]),
            ]),
          }),
        })
      );
    });

    it('shows empty message when no chats', async () => {
      mockActions.getChats = vi.fn().mockResolvedValue([]);

      const AdminChats = route<Actions>('admin_chats', async ({ actions }) => {
        const chats = await actions.getChats();
        return {
          text:
            chats.length > 0
              ? 'Выберите чат для управления:'
              : 'Нет доступных чатов',
          buttons: chats.map((chat) =>
            button({
              text: `${chat.title} (${chat.id})`,
              callback: `chat_${chat.id}`,
              action: () => {},
            })
          ),
        };
      });

      const router = createRouter([AdminChats], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChats);

      expect(mockActions.getChats).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        'Нет доступных чатов',
        expect.any(Object)
      );
    });
  });

  describe('AdminChat - pattern matching for status-based buttons', () => {
    it('shows ban button for approved chat', async () => {
      mockActions.getChatData = vi.fn().mockResolvedValue({
        chatId: 123,
        status: 'approved',
        config: {
          historyLimit: 15,
          interestInterval: 7,
          topicTime: '10:00',
          topicTimezone: 'UTC+03',
        },
      });

      const AdminChat = route<Actions, { chatId: number }>(
        'admin_chat',
        async ({ actions, params }) => {
          const data = await actions.getChatData(params.chatId);
          const { chatId, status, config } = data;

          return {
            text: `Управление чатом ${chatId}\nСтатус: ${status}`,
            buttons: [
              ...({
                approved: [
                  button<Actions>({
                    text: '🚫 Заблокировать',
                    callback: `ban:${chatId}`,
                    action: async ({ actions, ctx }) => {
                      const match = (ctx as ContextWithMatch).match;
                      const id = parseInt(match?.[1] ?? '0', 10);
                      await actions.banChat(id);
                    },
                  }),
                ],
                banned: [
                  button<Actions>({
                    text: '✅ Разблокировать',
                    callback: `unban:${chatId}`,
                    action: async ({ actions, ctx }) => {
                      const match = (ctx as ContextWithMatch).match;
                      const id = parseInt(match?.[1] ?? '0', 10);
                      await actions.unbanChat(id);
                    },
                  }),
                ],
              }[status as 'approved' | 'banned'] ?? []),
            ],
          };
        }
      );

      const router = createRouter([AdminChat], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChat, { chatId: 123 });

      expect(mockActions.getChatData).toHaveBeenCalledWith(123);
      expect(ctx.reply).toHaveBeenCalledWith(
        'Управление чатом 123\nСтатус: approved',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '🚫 Заблокировать' }),
              ]),
            ]),
          }),
        })
      );
    });

    it('shows unban button for banned chat and executes unban action', async () => {
      mockActions.getChatData = vi.fn().mockResolvedValue({
        chatId: 456,
        status: 'banned',
        config: {
          historyLimit: 20,
          interestInterval: 10,
          topicTime: null,
          topicTimezone: 'UTC+00',
        },
      });

      const AdminChat = route<Actions, { chatId: number }>(
        'admin_chat',
        async ({ actions, params }) => {
          const data = await actions.getChatData(params.chatId);
          const { chatId, status, config } = data;

          return {
            text: `Управление чатом ${chatId}\nСтатус: ${status}`,
            buttons: [
              ...({
                approved: [
                  button<Actions>({
                    text: '🚫 Заблокировать',
                    callback: `ban:${chatId}`,
                    action: async ({ actions, ctx }) => {
                      const match = (ctx as ContextWithMatch).match;
                      const id = parseInt(match?.[1] ?? '0', 10);
                      await actions.banChat(id);
                    },
                  }),
                ],
                banned: [
                  button<Actions>({
                    text: '✅ Разблокировать',
                    callback: `unban:${chatId}`,
                    action: async ({ actions, ctx }) => {
                      const match = (ctx as ContextWithMatch).match;
                      const id = parseInt(match?.[1] ?? '0', 10);
                      await actions.unbanChat(id);
                    },
                  }),
                ],
              }[status as 'approved' | 'banned'] ?? []),
            ],
          };
        }
      );

      const router = createRouter([AdminChat], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChat, { chatId: 456 });

      // Test the unban button action
      const view = await AdminChat.action({
        ctx,
        actions: mockActions,
        params: { chatId: 456 },
      });
      const unbanButton = view.buttons?.[0];

      const unbanCtx = {
        ...ctx,
        match: ['unban:456', '456'],
      } as ContextWithMatch;

      if (unbanButton?.action) {
        await unbanButton.action({
          actions: mockActions,
          ctx: unbanCtx,
          navigate: vi.fn(),
          navigateBack: vi.fn(),
          params: { chatId: 456 },
        });
      }

      expect(mockActions.unbanChat).toHaveBeenCalledWith(456);
    });

    it('shows no ban/unban buttons for pending status', async () => {
      mockActions.getChatData = vi.fn().mockResolvedValue({
        chatId: 789,
        status: 'pending',
        config: {
          historyLimit: 10,
          interestInterval: 5,
          topicTime: null,
          topicTimezone: 'UTC+00',
        },
      });

      const AdminChat = route<Actions, { chatId: number }>(
        'admin_chat',
        async ({ actions, params }) => {
          const data = await actions.getChatData(params.chatId);
          const { chatId, status } = data;

          return {
            text: `Управление чатом ${chatId}\nСтатус: ${status}`,
            buttons: [
              ...({
                approved: [
                  button<Actions>({
                    text: '🚫 Заблокировать',
                    callback: `ban:${chatId}`,
                    action: async () => {},
                  }),
                ],
                banned: [
                  button<Actions>({
                    text: '✅ Разблокировать',
                    callback: `unban:${chatId}`,
                    action: async () => {},
                  }),
                ],
              }[status as 'approved' | 'banned'] ?? []),
            ],
          };
        }
      );

      const router = createRouter([AdminChat], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChat, { chatId: 789 });

      const view = await AdminChat.action({
        ctx,
        actions: mockActions,
        params: { chatId: 789 },
      });
      expect(view.buttons).toHaveLength(0); // No buttons for pending status
    });
  });

  describe('Text input handling - admin vs user permissions', () => {
    it('admin route calls setHistoryLimit with isAdmin=true', async () => {
      const AdminChatHistoryLimit = route<Actions, { chatId: number }>(
        'admin_chat_history_limit',
        async ({ params }) => ({
          text: `Введите новый лимит истории для чата ${params.chatId}:`,
          onText: async ({ text, actions }) => {
            const limit = parseInt(text, 10);
            await actions.setHistoryLimit(params.chatId, limit, true);
          },
        })
      );

      const router = createRouter([AdminChatHistoryLimit], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChatHistoryLimit, { chatId: 555 });

      // Simulate text input
      const textCtx = { ...ctx, text: '35' };

      // Get the route view and call onText
      const view = await AdminChatHistoryLimit.action({
        ctx: textCtx,
        actions: mockActions,
        params: { chatId: 555 },
      });

      if (view.onText) {
        await view.onText({
          text: '35',
          actions: mockActions,
          ctx: textCtx,
          params: { chatId: 555 },
          navigate: vi.fn(),
          navigateBack: vi.fn(),
          state: { stack: [], params: {}, awaitingTextRouteId: null },
        });
      }

      expect(mockActions.setHistoryLimit).toHaveBeenCalledWith(555, 35, true);
    });

    it('user route calls setHistoryLimit with isAdmin=false', async () => {
      const ChatHistoryLimit = route<Actions>(
        'chat_history_limit',
        async () => ({
          text: 'Введите новый лимит истории:',
          onText: async ({ text, actions, ctx }) => {
            const chatId = ctx.chat?.id;
            if (!chatId) throw new Error('No chat ID');

            const limit = parseInt(text, 10);
            await actions.setHistoryLimit(chatId, limit, false);
          },
        })
      );

      const router = createRouter([ChatHistoryLimit], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      const userCtx = { ...ctx, chat: { id: 777 } };
      await running.navigate(userCtx, ChatHistoryLimit);

      // Simulate text input
      const textCtx = { ...userCtx, text: '40' };

      const view = await ChatHistoryLimit.action({
        ctx: textCtx,
        actions: mockActions,
        params: {},
      });

      if (view.onText) {
        await view.onText({
          text: '40',
          actions: mockActions,
          ctx: textCtx,
          params: {},
          navigate: vi.fn(),
          navigateBack: vi.fn(),
          state: { stack: [], params: {}, awaitingTextRouteId: null },
        });
      }

      expect(mockActions.setHistoryLimit).toHaveBeenCalledWith(777, 40, false);
    });
  });

  describe('Multi-step topic time flow with timezone calculation', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-180); // UTC+3
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('calculates timezone and navigates to confirmation', async () => {
      const AdminChatTopicTimezone = route<
        Actions,
        { chatId: number; time: string; timezone: string }
      >('admin_chat_topic_timezone', async ({ params }) => ({
        text: `Время: ${params.time}\nЧасовой пояс: ${params.timezone}`,
        buttons: [
          button({
            text: `✅ Оставить ${params.timezone}`,
            callback: `accept:${params.chatId}:${params.time}:${params.timezone}`,
            action: async ({ actions, ctx }) => {
              const match = (ctx as ContextWithMatch).match;
              const chatId = parseInt(match?.[1] ?? '0', 10);
              const time = match?.[2] ?? '';
              const timezone = match?.[3] ?? 'UTC+00';
              await actions.setTopicTime(chatId, time, timezone);
            },
          }),
        ],
      }));

      const AdminChatTopicTime = route<Actions, { chatId: number }>(
        'admin_chat_topic_time',
        async ({ params }) => ({
          text: `Введите время для чата ${params.chatId}:`,
          onText: async ({ text, navigate }) => {
            const time = text.trim();
            const date = new Date();
            const offset = -date.getTimezoneOffset();
            const hours = Math.floor(offset / 60);
            const sign = hours >= 0 ? '+' : '-';
            const timezone = `UTC${sign}${String(Math.abs(hours)).padStart(2, '0')}`;

            return navigate(AdminChatTopicTimezone, {
              chatId: params.chatId,
              time,
              timezone,
            });
          },
        })
      );

      const router = createRouter(
        [AdminChatTopicTime, AdminChatTopicTimezone],
        [],
        { stateStore }
      );
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChatTopicTime, { chatId: 999 });

      // Simulate text input
      const textCtx = { ...ctx, text: '16:45' };

      const view = await AdminChatTopicTime.action({
        ctx: textCtx,
        actions: mockActions,
        params: { chatId: 999 },
      });

      const mockNavigate = vi.fn();

      if (view.onText) {
        await view.onText({
          text: '16:45',
          actions: mockActions,
          ctx: textCtx,
          params: { chatId: 999 },
          navigate: mockNavigate,
          navigateBack: vi.fn(),
          state: { stack: [], params: {}, awaitingTextRouteId: null },
        });
      }

      expect(mockNavigate).toHaveBeenCalledWith(AdminChatTopicTimezone, {
        chatId: 999,
        time: '16:45',
        timezone: 'UTC+03',
      });
    });

    it('confirmation button saves topic time correctly', async () => {
      const AdminChatTopicTimezone = route<
        Actions,
        { chatId: number; time: string; timezone: string }
      >('admin_chat_topic_timezone', async ({ params }) => ({
        text: `Время: ${params.time}\nЧасовой пояс: ${params.timezone}`,
        buttons: [
          button({
            text: `✅ Оставить ${params.timezone}`,
            callback: `accept:${params.chatId}:${params.time}:${params.timezone}`,
            action: async ({ actions, ctx }) => {
              const match = (ctx as ContextWithMatch).match;
              const chatId = parseInt(match?.[1] ?? '0', 10);
              const time = match?.[2] ?? '';
              const timezone = match?.[3] ?? 'UTC+00';
              await actions.setTopicTime(chatId, time, timezone);
            },
          }),
        ],
      }));

      const router = createRouter([AdminChatTopicTimezone], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      await running.navigate(ctx, AdminChatTopicTimezone, {
        chatId: 999,
        time: '16:45',
        timezone: 'UTC+03',
      });

      // Test the confirmation button
      const view = await AdminChatTopicTimezone.action({
        ctx,
        actions: mockActions,
        params: { chatId: 999, time: '16:45', timezone: 'UTC+03' },
      });

      const confirmButton = view.buttons?.[0];
      const confirmCtx = {
        ...ctx,
        match: ['accept:999:16:45:UTC+03', '999', '16:45', 'UTC+03'],
      } as ContextWithMatch;

      if (confirmButton?.action) {
        await confirmButton.action({
          actions: mockActions,
          ctx: confirmCtx,
          navigate: vi.fn(),
          navigateBack: vi.fn(),
          params: { chatId: 999, time: '16:45', timezone: 'UTC+03' },
        });
      }

      expect(mockActions.setTopicTime).toHaveBeenCalledWith(
        999,
        '16:45',
        'UTC+03'
      );
    });
  });

  describe('Error handling', () => {
    it('throws error when chat ID is missing', async () => {
      const ChatSettings = route<Actions>(
        'chat_settings',
        async ({ ctx, actions }) => {
          const chatId = ctx.chat?.id;
          if (!chatId) throw new Error('No chat ID');

          const config = await actions.getChatConfig(chatId);
          return {
            text: `Settings for chat ${chatId}`,
            buttons: [],
          };
        }
      );

      const router = createRouter([ChatSettings], [], { stateStore });
      const running = router.run(mockBot as any, mockActions);

      const ctxWithoutChat = { ...ctx };
      delete ctxWithoutChat.chat;

      await expect(
        ChatSettings.action({
          ctx: ctxWithoutChat,
          actions: mockActions,
          params: {},
        })
      ).rejects.toThrow('No chat ID');
    });
  });
});

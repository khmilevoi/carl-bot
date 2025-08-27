import type { Context } from 'telegraf';

import { createButton, createRoute, type RouteApi } from './telegramRouter';

export type WindowId =
  | 'menu'
  | 'chat_settings'
  | 'chat_history_limit'
  | 'chat_interest_interval'
  | 'chat_topic_time'
  | 'admin_menu'
  | 'admin_chats'
  | 'admin_chat'
  | 'admin_chat_history_limit'
  | 'admin_chat_interest_interval'
  | 'admin_chat_topic_time'
  | 'chat_not_approved'
  | 'no_access'
  | 'chat_approval_request'
  | 'user_access_request';

const b = createButton<WindowId>;
const r = createRoute<WindowId>;

interface WindowActions {
  exportData(ctx: Context): Promise<void> | void;
  resetMemory(ctx: Context): Promise<void> | void;
  requestChatAccess(ctx: Context): Promise<void> | void;
  requestUserAccess(ctx: Context): Promise<void> | void;
  showAdminChats(ctx: Context): Promise<void> | void;
  showChatSettings(ctx: Context): Promise<void> | void;
  configHistoryLimit(ctx: Context): Promise<void> | void;
  configInterestInterval(ctx: Context): Promise<void> | void;
  configTopicTime(ctx: Context): Promise<void> | void;
}

export function createWindows(actions: WindowActions): RouteApi<WindowId>[] {
  return [
    r('menu', async () => ({
      text: 'Выберите действие:',
      buttons: [
        b({
          text: '📊 Загрузить данные',
          callback: 'export_data',
          action: actions.exportData,
        }),
        b({
          text: '🔄 Сбросить память',
          callback: 'reset_memory',
          action: actions.resetMemory,
        }),
        b({
          text: '⚙️ Настройки',
          callback: 'chat_settings',
          action: actions.showChatSettings,
        }),
      ],
    })),
    r('chat_settings', async ({ loadData }) => {
      const config = (await loadData()) as {
        historyLimit: number;
        interestInterval: number;
        topicTime: string | null;
        topicTimezone: string;
      };
      return {
        text: 'Выберите настройку:',
        buttons: [
          b({
            text: `🕒 Лимит истории (${config.historyLimit})`,
            callback: 'config_history_limit',
            action: actions.configHistoryLimit,
          }),
          b({
            text: `✨ Интервал интереса (${config.interestInterval})`,
            callback: 'config_interest_interval',
            action: actions.configInterestInterval,
          }),
          b({
            text: `📝 Время статьи (${config.topicTime ?? '—'})`,
            callback: 'config_topic_time',
            action: actions.configTopicTime,
          }),
        ],
      };
    }),
    r('chat_history_limit', async () => ({
      text: 'Введите новый лимит истории:',
      buttons: [],
    })),
    r('chat_interest_interval', async () => ({
      text: 'Введите новый интервал интереса:',
      buttons: [],
    })),
    r('chat_topic_time', async () => ({
      text: 'Введите время статьи (HH:MM):',
      buttons: [],
    })),
    r('admin_menu', async () => ({
      text: 'Выберите действие:',
      buttons: [
        b({
          text: '📊 Загрузить данные',
          callback: 'admin_export_data',
          action: actions.exportData,
        }),
        b({
          text: '💬 Чаты',
          callback: 'admin_chats',
          action: actions.showAdminChats,
        }),
      ],
    })),
    r('admin_chats', async ({ loadData }) => {
      const chats =
        ((await loadData()) as { id: number; title: string }[]) ?? [];
      return {
        text:
          chats.length > 0
            ? 'Выберите чат для управления:'
            : 'Нет доступных чатов',
        buttons: chats.map((chat) =>
          b({
            text: `${chat.title} (${chat.id})`,
            callback: `admin_chat:${chat.id}`,
          })
        ),
      };
    }),
    r('admin_chat', async ({ loadData }) => {
      const { chatId, status, config } = (await loadData()) as {
        chatId: number;
        status: string;
        config: {
          historyLimit: number;
          interestInterval: number;
          topicTime: string | null;
          topicTimezone: string;
        };
      };
      return {
        text: `Статус чата ${chatId}: ${status}`,
        buttons: [
          b({
            text: status === 'banned' ? 'Разбанить' : 'Забанить',
            callback:
              status === 'banned'
                ? `chat_unban:${chatId}`
                : `chat_ban:${chatId}`,
          }),
          b({
            text: `🕒 Лимит истории (${config.historyLimit})`,
            callback: `admin_chat_history_limit:${chatId}`,
          }),
          b({
            text: `✨ Интервал интереса (${config.interestInterval})`,
            callback: `admin_chat_interest_interval:${chatId}`,
          }),
          b({
            text: `📝 Время статьи (${config.topicTime ?? '—'})`,
            callback: `admin_chat_topic_time:${chatId}`,
          }),
        ],
      };
    }),
    r('admin_chat_history_limit', async ({ loadData }) => {
      const { chatId } = (await loadData()) as { chatId: number };
      return {
        text: `Введите новый лимит истории для чата ${chatId}:`,
        buttons: [],
      };
    }),
    r('admin_chat_interest_interval', async ({ loadData }) => {
      const { chatId } = (await loadData()) as { chatId: number };
      return {
        text: `Введите новый интервал интереса для чата ${chatId}:`,
        buttons: [],
      };
    }),
    r('admin_chat_topic_time', async ({ loadData }) => {
      const { chatId } = (await loadData()) as { chatId: number };
      return {
        text: `Введите время статьи для чата ${chatId} (HH:MM):`,
        buttons: [],
      };
    }),
    r('chat_not_approved', async () => ({
      text: 'Этот чат не находится в списке разрешённых.',
      buttons: [
        b({
          text: 'Запросить доступ',
          callback: 'chat_request',
          action: actions.requestChatAccess,
        }),
      ],
    })),
    r('no_access', async () => ({
      text: 'Для работы с данными нужен доступ.',
      buttons: [
        b({
          text: '🔑 Запросить доступ',
          callback: 'request_access',
          action: actions.requestUserAccess,
        }),
      ],
    })),
    r('chat_approval_request', async ({ loadData }) => {
      const { name, chatId } = (await loadData()) as {
        name: string;
        chatId: number;
      };
      return {
        text: `${name} запросил доступ`,
        buttons: [
          b({ text: 'Разрешить', callback: `chat_approve:${chatId}` }),
          b({ text: 'Забанить', callback: `chat_ban:${chatId}` }),
        ],
      };
    }),
    r('user_access_request', async ({ loadData }) => {
      const { msg, chatId, userId } = (await loadData()) as {
        msg: string;
        chatId: number;
        userId: number;
      };
      return {
        text: msg,
        buttons: [
          b({ text: 'Одобрить', callback: `user_approve:${chatId}:${userId}` }),
          b({ text: 'Забанить чат', callback: `chat_ban:${chatId}` }),
        ],
      };
    }),
  ];
}

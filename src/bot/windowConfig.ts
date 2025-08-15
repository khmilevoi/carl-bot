import type { Context } from 'telegraf';

import {
  createButton,
  createRoute,
  type RouteApi,
} from '../infrastructure/telegramRouter';

export type WindowId =
  | 'menu'
  | 'admin_menu'
  | 'admin_chats'
  | 'admin_chat'
  | 'chat_not_approved'
  | 'no_access'
  | 'chat_approval_request'
  | 'user_access_request';

export type WindowDefinition = RouteApi<WindowId>;

const b = createButton<WindowId>;
const r = createRoute<WindowId>;

interface WindowActions {
  exportData(ctx: Context): Promise<void> | void;
  resetMemory(ctx: Context): Promise<void> | void;
  requestChatAccess(ctx: Context): Promise<void> | void;
  requestUserAccess(ctx: Context): Promise<void> | void;
  getChats(): Promise<{ id: number; title: string }[]>;
}

export function createWindows(actions: WindowActions): WindowDefinition[] {
  return [
    r({
      id: 'menu',
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
      ],
    }),
    r({
      id: 'admin_menu',
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
          target: 'admin_chats',
        }),
      ],
    }),
    r({
      id: 'admin_chats',
      text: 'Выберите чат для управления:',
      buttons: async () =>
        (await actions.getChats()).map((chat) =>
          b({
            text: `${chat.title} (${chat.id})`,
            callback: `admin_chat:${chat.id}`,
          })
        ),
    }),
    r({ id: 'admin_chat', text: '', buttons: [] }),
    r({
      id: 'chat_not_approved',
      text: 'Этот чат не находится в списке разрешённых.',
      buttons: [
        b({
          text: 'Запросить доступ',
          callback: 'chat_request',
          action: actions.requestChatAccess,
        }),
      ],
    }),
    r({
      id: 'no_access',
      text: 'Для работы с данными нужен доступ.',
      buttons: [
        b({
          text: '🔑 Запросить доступ',
          callback: 'request_access',
          action: actions.requestUserAccess,
        }),
      ],
    }),
    r({ id: 'chat_approval_request', text: '', buttons: [] }),
    r({ id: 'user_access_request', text: '', buttons: [] }),
  ];
}

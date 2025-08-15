import {
  createButton,
  createRoute,
  type RouteApi,
} from '../infrastructure/telegramRouter';

type WindowAction =
  | 'exportData'
  | 'resetMemory'
  | 'showAdminChatsMenu'
  | 'requestChatAccess'
  | 'requestUserAccess';

type WindowId = 'menu' | 'admin_menu' | 'chat_not_approved' | 'no_access';

type WindowDefinition = RouteApi<WindowAction, WindowId>;

const b = createButton<WindowAction, WindowId>;
const r = createRoute<WindowAction, WindowId>;

export const windows: WindowDefinition[] = [
  r({
    id: 'menu',
    text: 'Выберите действие:',
    buttons: [
      b({
        text: '📊 Загрузить данные',
        callback: 'export_data',
        action: 'exportData',
      }),
      b({
        text: '🔄 Сбросить память',
        callback: 'reset_memory',
        action: 'resetMemory',
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
        action: 'exportData',
      }),
      b({
        text: '💬 Чаты',
        callback: 'admin_chats',
        action: 'showAdminChatsMenu',
      }),
    ],
  }),
  r({
    id: 'chat_not_approved',
    text: 'Этот чат не находится в списке разрешённых.',
    buttons: [
      b({
        text: 'Запросить доступ',
        callback: 'chat_request',
        action: 'requestChatAccess',
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
        action: 'requestUserAccess',
      }),
    ],
  }),
];

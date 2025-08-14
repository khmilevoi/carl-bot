interface WindowButton {
  text: string;
  callback: string;
  target?: string;
  action?: string;
}

export interface WindowDefinition {
  id: string;
  text: string;
  buttons: WindowButton[];
}

export const windows: WindowDefinition[] = [
  {
    id: 'menu',
    text: 'Выберите действие:',
    buttons: [
      {
        text: '📊 Загрузить данные',
        callback: 'export_data',
        action: 'exportData',
      },
      {
        text: '🔄 Сбросить память',
        callback: 'reset_memory',
        action: 'resetMemory',
      },
    ],
  },
  {
    id: 'admin_menu',
    text: 'Выберите действие:',
    buttons: [
      {
        text: '📊 Загрузить данные',
        callback: 'admin_export_data',
        action: 'exportData',
      },
      {
        text: '💬 Чаты',
        callback: 'admin_chats',
        action: 'showAdminChatsMenu',
      },
    ],
  },
  {
    id: 'chat_not_approved',
    text: 'Этот чат не находится в списке разрешённых.',
    buttons: [
      {
        text: 'Запросить доступ',
        callback: 'chat_request',
        action: 'requestChatAccess',
      },
    ],
  },
  {
    id: 'no_access',
    text: 'Для работы с данными нужен доступ.',
    buttons: [
      {
        text: '🔑 Запросить доступ',
        callback: 'request_access',
        action: 'requestUserAccess',
      },
    ],
  },
];

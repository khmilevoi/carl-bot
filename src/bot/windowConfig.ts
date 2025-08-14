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
    id: 'main',
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
    id: 'admin_main',
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
];

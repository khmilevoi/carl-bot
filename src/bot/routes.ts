import type { Context } from 'telegraf';

import { createButton, createRoute } from './router/factories';

export type RoutesApi = {
  exportData: (ctx: Context) => Promise<void> | void;
  resetMemory: (ctx: Context) => Promise<void> | void;
  requestChatAccess: (ctx: Context) => Promise<void> | void;
  requestUserAccess: (ctx: Context) => Promise<void> | void;
  listChats: () => Promise<{ chatId: number }[]>;
  getChatTitle: (chatId: number) => Promise<string>;
  showChatStatus: (ctx: Context, chatId: number) => Promise<void> | void;
};

const menu = createRoute<RoutesApi>('menu', 'Выберите действие:', () => ({
  buttons: [
    createButton<RoutesApi>('📊 Загрузить данные', (a, ctx) =>
      a.exportData(ctx)
    ),
    createButton<RoutesApi>('🔄 Сбросить память', (a, ctx) =>
      a.resetMemory(ctx)
    ),
  ],
}));

const admin_menu = createRoute<RoutesApi>(
  'admin_menu',
  'Выберите действие:',
  () => ({
    buttons: [
      createButton<RoutesApi>('📊 Загрузить данные', (a, ctx) =>
        a.exportData(ctx)
      ),
      createButton<RoutesApi>('💬 Чаты', (a, ctx) =>
        a.show(ctx, 'admin_chats')
      ),
    ],
  })
);

const chat_not_approved = createRoute<RoutesApi>(
  'chat_not_approved',
  'Этот чат не находится в списке разрешённых.',
  () => ({
    buttons: [
      createButton<RoutesApi>('Запросить доступ', (a, ctx) =>
        a.requestChatAccess(ctx)
      ),
    ],
  })
);

const no_access = createRoute<RoutesApi>(
  'no_access',
  'Для работы с данными нужен доступ.',
  () => ({
    buttons: [
      createButton<RoutesApi>('🔑 Запросить доступ', (a, ctx) =>
        a.requestUserAccess(ctx)
      ),
    ],
  })
);

export const admin_chats = createRoute<RoutesApi>(
  'admin_chats',
  'Выберите чат для управления:',
  async (api, ctx: Context) => {
    const chats = await api.listChats();
    if (chats.length === 0) {
      await ctx.reply('Нет чатов для управления');
      return { buttons: [] };
    }
    const buttons = await Promise.all(
      chats.map(async ({ chatId }) => {
        const title = await api.getChatTitle(chatId);
        return createButton<RoutesApi>(`${title} (${chatId})`, (a, bCtx) =>
          a.showChatStatus(bCtx, chatId)
        );
      })
    );
    return { buttons };
  }
);

export const routes = [
  menu,
  admin_menu,
  chat_not_approved,
  no_access,
  admin_chats,
];

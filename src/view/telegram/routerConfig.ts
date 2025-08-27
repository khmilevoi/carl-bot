import type { Context } from 'telegraf';

import { button, cb, DSL, route } from './telegraf-inline-router';

interface ChatConfigParams {
  historyLimit: number;
  interestInterval: number;
  topicTime: string | null;
  topicTimezone: string;
}

interface AdminChatParams {
  chatId: number;
  status: string;
  config: ChatConfigParams;
}

// eslint-disable-next-line import/no-unused-modules
export interface Actions {
  exportData(ctx: Context): Promise<void> | void;
  resetMemory(ctx: Context): Promise<void> | void;
  requestChatAccess(ctx: Context): Promise<void> | void;
  requestUserAccess(ctx: Context): Promise<void> | void;
  showAdminChats(ctx: Context): Promise<void> | void;
  showChatSettings(ctx: Context): Promise<void> | void;
  configHistoryLimit(ctx: Context): Promise<void> | void;
  configInterestInterval(ctx: Context): Promise<void> | void;
  configTopicTime(ctx: Context): Promise<void> | void;
  showAdminChat(ctx: Context, chatId: number): Promise<void> | void;
  handleAdminConfigHistoryLimit(
    ctx: Context,
    chatId: number
  ): Promise<void> | void;
  handleAdminConfigInterestInterval(
    ctx: Context,
    chatId: number
  ): Promise<void> | void;
  handleAdminConfigTopicTime(
    ctx: Context,
    chatId: number
  ): Promise<void> | void;
  approveChat(ctx: Context, chatId: number): Promise<void> | void;
  banChat(ctx: Context, chatId: number): Promise<void> | void;
  unbanChat(ctx: Context, chatId: number): Promise<void> | void;
  approveUser(
    ctx: Context,
    chatId: number,
    userId: number
  ): Promise<void> | void;
}

const { row, rows } = DSL;

const menu = route<Actions>({
  id: 'menu',
  async action({ actions }) {
    return {
      text: 'Выберите действие:',
      buttons: rows(
        row(
          button({
            text: '📊 Загрузить данные',
            callback: cb('export_data'),
            action: ({ ctx }) => actions.exportData(ctx),
          })
        ),
        row(
          button({
            text: '🔄 Сбросить память',
            callback: cb('reset_memory'),
            action: ({ ctx }) => actions.resetMemory(ctx),
          })
        ),
        row(
          button({
            text: '⚙️ Настройки',
            callback: cb('chat_settings'),
            action: ({ ctx }) => actions.showChatSettings(ctx),
          })
        )
      ),
    };
  },
});

const chatSettings = route<Actions, ChatConfigParams>({
  id: 'chat_settings',
  async action({ params, actions }) {
    const config = params;
    return {
      text: 'Выберите настройку:',
      buttons: rows(
        row(
          button({
            text: `🕒 Лимит истории (${config.historyLimit})`,
            callback: cb('config_history_limit'),
            action: ({ ctx }) => actions.configHistoryLimit(ctx),
          })
        ),
        row(
          button({
            text: `✨ Интервал интереса (${config.interestInterval})`,
            callback: cb('config_interest_interval'),
            action: ({ ctx }) => actions.configInterestInterval(ctx),
          })
        ),
        row(
          button({
            text: `📝 Время статьи (${config.topicTime ?? '—'})`,
            callback: cb('config_topic_time'),
            action: ({ ctx }) => actions.configTopicTime(ctx),
          })
        )
      ),
    };
  },
});

const chatHistoryLimit = route<Actions>({
  id: 'chat_history_limit',
  waitForText: true,
  async action() {
    return { text: 'Введите новый лимит истории:', buttons: [] };
  },
});

const chatInterestInterval = route<Actions>({
  id: 'chat_interest_interval',
  waitForText: true,
  async action() {
    return { text: 'Введите новый интервал интереса:', buttons: [] };
  },
});

const chatTopicTime = route<Actions>({
  id: 'chat_topic_time',
  waitForText: true,
  async action() {
    return { text: 'Введите время статьи (HH:MM):', buttons: [] };
  },
});

const chatTopicTimezone = route<Actions, { timezone: string }>({
  id: 'chat_topic_timezone',
  waitForText: true,
  async action({ params }) {
    return {
      text: `Часовой пояс (${params.timezone}). Введите другой, если нужно:`,
      buttons: [],
    };
  },
});

const adminMenu = route<Actions>({
  id: 'admin_menu',
  async action({ actions }) {
    return {
      text: 'Выберите действие:',
      buttons: rows(
        row(
          button({
            text: '📊 Загрузить данные',
            callback: cb('admin_export_data'),
            action: ({ ctx }) => actions.exportData(ctx),
          })
        ),
        row(
          button({
            text: '💬 Чаты',
            callback: cb('admin_chats'),
            action: ({ ctx }) => actions.showAdminChats(ctx),
          })
        )
      ),
    };
  },
});

const adminChats = route<Actions, { id: number; title: string }[]>({
  id: 'admin_chats',
  async action({ params, actions }) {
    const chats = params;
    if (!chats?.length) {
      return { text: 'Нет доступных чатов', buttons: [] };
    }
    return {
      text: 'Выберите чат:',
      buttons: rows(
        ...chats.map((chat) =>
          row(
            button({
              text: `${chat.title} (${chat.id})`,
              callback: cb('admin_chat', [chat.id]),
              action: ({ ctx }) => actions.showAdminChat(ctx, chat.id),
            })
          )
        )
      ),
    };
  },
});

const adminChat = route<Actions, AdminChatParams | void>({
  id: 'admin_chat',
  async action({ ctx, params, actions }) {
    if (!params) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      await actions.showAdminChat(ctx, chatId);
      return;
    }
    const { chatId, status, config } = params;
    return {
      text: `Статус чата ${chatId}: ${status}`,
      buttons: rows(
        row(
          button({
            text: status === 'banned' ? 'Разбанить' : 'Забанить',
            callback: cb(status === 'banned' ? 'chat_unban' : 'chat_ban', [
              chatId,
            ]),
            action: ({ ctx }) =>
              status === 'banned'
                ? actions.unbanChat(ctx, chatId)
                : actions.banChat(ctx, chatId),
          })
        ),
        row(
          button({
            text: `🕒 Лимит истории (${config.historyLimit})`,
            callback: cb('admin_chat_history_limit', [chatId]),
            action: ({ ctx }) =>
              actions.handleAdminConfigHistoryLimit(ctx, chatId),
          })
        ),
        row(
          button({
            text: `✨ Интервал интереса (${config.interestInterval})`,
            callback: cb('admin_chat_interest_interval', [chatId]),
            action: ({ ctx }) =>
              actions.handleAdminConfigInterestInterval(ctx, chatId),
          })
        ),
        row(
          button({
            text: `📝 Время статьи (${config.topicTime ?? '—'})`,
            callback: cb('admin_chat_topic_time', [chatId]),
            action: ({ ctx }) =>
              actions.handleAdminConfigTopicTime(ctx, chatId),
          })
        )
      ),
    };
  },
});

const adminChatHistoryLimit = route<Actions, { chatId: number } | void>({
  id: 'admin_chat_history_limit',
  waitForText: true,
  async action({ ctx, params, actions }) {
    if (!params) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      await actions.handleAdminConfigHistoryLimit(ctx, chatId);
      return;
    }
    return {
      text: `Введите новый лимит истории для чата ${params.chatId}:`,
      buttons: [],
    };
  },
});

const adminChatInterestInterval = route<Actions, { chatId: number } | void>({
  id: 'admin_chat_interest_interval',
  waitForText: true,
  async action({ ctx, params, actions }) {
    if (!params) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      await actions.handleAdminConfigInterestInterval(ctx, chatId);
      return;
    }
    return {
      text: `Введите новый интервал интереса для чата ${params.chatId}:`,
      buttons: [],
    };
  },
});

const adminChatTopicTime = route<Actions, { chatId: number } | void>({
  id: 'admin_chat_topic_time',
  waitForText: true,
  async action({ ctx, params, actions }) {
    if (!params) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      await actions.handleAdminConfigTopicTime(ctx, chatId);
      return;
    }
    return {
      text: `Введите время статьи для чата ${params.chatId} (HH:MM):`,
      buttons: [],
    };
  },
});

const adminChatTopicTimezone = route<
  Actions,
  { chatId: number; timezone: string }
>({
  id: 'admin_chat_topic_timezone',
  waitForText: true,
  async action({ params }) {
    const { chatId, timezone } = params;
    return {
      text: `Часовой пояс для чата ${chatId} (${timezone}). Введите другой, если нужно:`,
      buttons: [],
    };
  },
});

const chatNotApproved = route<Actions>({
  id: 'chat_not_approved',
  async action({ actions }) {
    return {
      text: 'Этот чат не находится в списке разрешённых.',
      buttons: rows(
        row(
          button({
            text: 'Запросить доступ',
            callback: cb('chat_request'),
            action: ({ ctx }) => actions.requestChatAccess(ctx),
          })
        )
      ),
    };
  },
});

const noAccess = route<Actions>({
  id: 'no_access',
  async action({ actions }) {
    return {
      text: 'Для работы с данными нужен доступ.',
      buttons: rows(
        row(
          button({
            text: '🔑 Запросить доступ',
            callback: cb('request_access'),
            action: ({ ctx }) => actions.requestUserAccess(ctx),
          })
        )
      ),
    };
  },
});

const chatApprovalRequest = route<Actions, { name: string; chatId: number }>({
  id: 'chat_approval_request',
  async action({ params, actions }) {
    return {
      text: `${params.name} запросил доступ`,
      buttons: rows(
        row(
          button({
            text: 'Разрешить',
            callback: cb('chat_approve', [params.chatId]),
            action: ({ ctx }) => actions.approveChat(ctx, params.chatId),
          }),
          button({
            text: 'Забанить',
            callback: cb('chat_ban', [params.chatId]),
            action: ({ ctx }) => actions.banChat(ctx, params.chatId),
          })
        )
      ),
    };
  },
});

const userAccessRequest = route<
  Actions,
  {
    msg: string;
    chatId: number;
    userId: number;
  }
>({
  id: 'user_access_request',
  async action({ params, actions }) {
    return {
      text: params.msg,
      buttons: rows(
        row(
          button({
            text: 'Одобрить',
            callback: cb('user_approve', [params.chatId, params.userId]),
            action: ({ ctx }) =>
              actions.approveUser(ctx, params.chatId, params.userId),
          })
        ),
        row(
          button({
            text: 'Забанить чат',
            callback: cb('chat_ban', [params.chatId]),
            action: ({ ctx }) => actions.banChat(ctx, params.chatId),
          })
        )
      ),
    };
  },
});

const chatApprove = route<Actions>({
  id: 'chat_approve',
  async action({ ctx, actions }) {
    const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.approveChat(ctx, chatId);
  },
});

const chatBan = route<Actions>({
  id: 'chat_ban',
  async action({ ctx, actions }) {
    const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.banChat(ctx, chatId);
  },
});

const chatUnban = route<Actions>({
  id: 'chat_unban',
  async action({ ctx, actions }) {
    const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.unbanChat(ctx, chatId);
  },
});

const userApprove = route<Actions>({
  id: 'user_approve',
  async action({ ctx, actions }) {
    const match = (ctx as Context & { match?: string[] }).match;
    const chatId = Number(match?.[1]);
    const userId = Number(match?.[2]);
    await actions.approveUser(ctx, chatId, userId);
  },
});

// eslint-disable-next-line import/no-unused-modules
export const routes = [
  {
    route: menu,
    children: [
      {
        route: chatSettings,
        hasBack: true,
        children: [
          chatHistoryLimit,
          chatInterestInterval,
          chatTopicTime,
          chatTopicTimezone,
        ],
      },
    ],
  },
  {
    route: adminMenu,
    children: [
      {
        route: adminChats,
        hasBack: true,
        children: [
          {
            route: adminChat,
            hasBack: true,
            children: [
              adminChatHistoryLimit,
              adminChatInterestInterval,
              adminChatTopicTime,
              adminChatTopicTimezone,
            ],
          },
        ],
      },
    ],
  },
  { route: chatNotApproved },
  { route: noAccess },
  { route: chatApprovalRequest },
  { route: userAccessRequest },
  { route: chatApprove },
  { route: chatBan },
  { route: chatUnban },
  { route: userApprove },
];

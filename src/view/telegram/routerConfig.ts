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
  // Detached from Telegram ctx
  exportData(): Promise<void>;
  resetMemory(): Promise<void>;
  requestChatAccess(): Promise<void>;
  requestUserAccess(): Promise<void>;

  setHistoryLimit(chatId: number, value: number): Promise<void>;
  setInterestInterval(chatId: number, value: number): Promise<void>;
  setTopicTime(chatId: number, time: string, timezone: string): Promise<void>;
  rescheduleTopic(chatId: number): Promise<void>;

  // Data loaders for views
  loadChatSettings(): Promise<ChatConfigParams>;
  loadAdminChats(): Promise<{ id: number; title: string }[]>;
  loadAdminChat(chatId: number): Promise<AdminChatParams>;

  // Admin actions
  approveChat(chatId: number): Promise<void>;
  banChat(chatId: number): Promise<void>;
  unbanChat(chatId: number): Promise<void>;
  approveUser(chatId: number, userId: number): Promise<void>;
}

const { row, rows } = DSL;

const Menu = route<Actions>({
  id: 'menu',
  async action({ actions }) {
    return {
      text: 'Выберите действие:',
      buttons: rows(
        row(
          button({
            text: '📊 Загрузить данные',
            callback: cb('export_data'),
            action: async () => actions.exportData(),
          })
        ),
        row(
          button({
            text: '🔄 Сбросить память',
            callback: cb('reset_memory'),
            action: async () => actions.resetMemory(),
          })
        ),
        row(
          button({
            text: '⚙️ Настройки',
            callback: cb('chat_settings'),
            action: async ({ actions, navigate }) => {
              const config = await actions.loadChatSettings();
              await navigate(ChatSettings, config);
            },
          })
        )
      ),
    };
  },
});

const ChatSettings = route<Actions, ChatConfigParams>({
  id: 'chat_settings',
  async action({ params }) {
    const config = params;
    return {
      text: 'Выберите настройку:',
      buttons: rows(
        row(
          button({
            text: `🕒 Лимит истории (${config.historyLimit})`,
            callback: cb('config_history_limit'),
            action: async ({ navigate }) => navigate(ChatHistoryLimit),
          })
        ),
        row(
          button({
            text: `✨ Интервал интереса (${config.interestInterval})`,
            callback: cb('config_interest_interval'),
            action: async ({ navigate }) => navigate(ChatInterestInterval),
          })
        ),
        row(
          button({
            text: `📝 Время статьи (${config.topicTime ?? '—'})`,
            callback: cb('config_topic_time'),
            action: async ({ navigate }) => navigate(ChatTopicTime),
          })
        )
      ),
    };
  },
});

const ChatHistoryLimit = route<Actions>({
  id: 'chat_history_limit',
  async action() {
    return { text: 'Введите новый лимит истории:', buttons: [] };
  },
  async onText({ ctx, actions, text }) {
    const chatId = ctx.chat?.id;
    if (typeof chatId === 'number') {
      await actions.setHistoryLimit(chatId, Number(text));
      return { text: '✅ Лимит истории обновлён', buttons: [] };
    }
  },
});

const ChatInterestInterval = route<Actions>({
  id: 'chat_interest_interval',
  async action() {
    return { text: 'Введите новый интервал интереса:', buttons: [] };
  },
  async onText({ ctx, actions, text }) {
    const chatId = ctx.chat?.id;
    if (typeof chatId === 'number') {
      await actions.setInterestInterval(chatId, Number(text));
      return { text: '✅ Интервал интереса обновлён', buttons: [] };
    }
  },
});

const ChatTopicTime = route<Actions>({
  id: 'chat_topic_time',
  async action() {
    return { text: 'Введите время статьи (HH:MM):', buttons: [] };
  },
  async onText({ ctx, text, navigate }) {
    const date =
      ctx.message && 'date' in ctx.message
        ? new Date(ctx.message.date * 1000)
        : new Date();
    const offset = -date.getTimezoneOffset();
    const hours = Math.floor(offset / 60);
    const sign = hours >= 0 ? '+' : '-';
    const timezone = `UTC${sign}${String(Math.abs(hours)).padStart(2, '0')}`;
    await navigate(ChatTopicTimezone, { time: text, timezone });
  },
});

const ChatTopicTimezone = route<Actions, { time: string; timezone: string }>({
  id: 'chat_topic_timezone',
  async action({ params }) {
    return {
      text: `Часовой пояс (${params.timezone}). Введите другой, если нужно:`,
      buttons: [],
    };
  },
  async onText({ ctx, actions, params, text }) {
    const chatId = ctx.chat?.id;
    if (typeof chatId === 'number') {
      const tz = text.trim() === '' ? params.timezone : text.trim();
      await actions.setTopicTime(chatId, params.time, tz);
      await actions.rescheduleTopic(chatId);
      return { text: '✅ Время статьи обновлено', buttons: [] };
    }
  },
});

const AdminMenu = route<Actions>({
  id: 'admin_menu',
  async action({ actions }) {
    return {
      text: 'Выберите действие:',
      buttons: rows(
        row(
          button({
            text: '📊 Загрузить данные',
            callback: cb('admin_export_data'),
            action: async () => actions.exportData(),
          })
        ),
        row(
          button({
            text: '💬 Чаты',
            callback: cb('admin_chats'),
            action: async ({ actions, navigate }) => {
              const chats = await actions.loadAdminChats();
              await navigate(AdminChats, chats);
            },
          })
        )
      ),
    };
  },
});

const AdminChats = route<Actions, { id: number; title: string }[]>({
  id: 'admin_chats',
  async action({ params }) {
    const chats = params;
    if (!chats?.length) {
      return { text: 'Нет доступных чатов', buttons: [] };
    }
    return {
      text: 'Выберите чат:',
      buttons: rows(
        ...chats.map((chat) =>
          row(
            button<Actions>({
              text: `${chat.title} (${chat.id})`,
              callback: cb('admin_chat', [chat.id]),
              action: async ({ actions, navigate }) => {
                const data = await actions.loadAdminChat(chat.id);
                await navigate(AdminChat, data);
              },
            })
          )
        )
      ),
    };
  },
});

const AdminChat = route<Actions, AdminChatParams | void>({
  id: 'admin_chat',
  async action({ ctx, params, actions }) {
    let p = params;
    if (!p) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      p = await actions.loadAdminChat(chatId);
    }
    const { chatId, status, config } = p as AdminChatParams;
    return {
      text: `Статус чата ${chatId}: ${status}`,
      buttons: rows(
        row(
          button({
            text: status === 'banned' ? 'Разбанить' : 'Забанить',
            callback: cb(status === 'banned' ? 'chat_unban' : 'chat_ban', [
              chatId,
            ]),
            action: async ({ actions }) =>
              status === 'banned'
                ? actions.unbanChat(chatId)
                : actions.banChat(chatId),
          })
        ),
        row(
          button({
            text: `🕒 Лимит истории (${config.historyLimit})`,
            callback: cb('admin_chat_history_limit', [chatId]),
            action: async ({ navigate }) =>
              navigate(AdminChatHistoryLimit, { chatId }),
          })
        ),
        row(
          button({
            text: `✨ Интервал интереса (${config.interestInterval})`,
            callback: cb('admin_chat_interest_interval', [chatId]),
            action: async ({ navigate }) =>
              navigate(AdminChatInterestInterval, { chatId }),
          })
        ),
        row(
          button({
            text: `📝 Время статьи (${config.topicTime ?? '—'})`,
            callback: cb('admin_chat_topic_time', [chatId]),
            action: async ({ navigate }) =>
              navigate(AdminChatTopicTime, { chatId }),
          })
        )
      ),
    };
  },
});

const AdminChatHistoryLimit = route<Actions, { chatId: number } | void>({
  id: 'admin_chat_history_limit',
  async action({ ctx, params }) {
    if (!params) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      return {
        text: `Введите новый лимит истории для чата ${chatId}:`,
        buttons: [],
      };
    }
    return {
      text: `Введите новый лимит истории для чата ${params.chatId}:`,
      buttons: [],
    };
  },
  async onText({ ctx, actions, params, text }) {
    const chatId =
      params?.chatId ??
      Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.setHistoryLimit(chatId, Number(text));
    return { text: '✅ Лимит истории обновлён', buttons: [] };
  },
});

const AdminChatInterestInterval = route<Actions, { chatId: number } | void>({
  id: 'admin_chat_interest_interval',
  async action({ ctx, params }) {
    if (!params) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      return {
        text: `Введите новый интервал интереса для чата ${chatId}:`,
        buttons: [],
      };
    }
    return {
      text: `Введите новый интервал интереса для чата ${params.chatId}:`,
      buttons: [],
    };
  },
  async onText({ ctx, actions, params, text }) {
    const chatId =
      params?.chatId ??
      Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.setInterestInterval(chatId, Number(text));
    return { text: '✅ Интервал интереса обновлён', buttons: [] };
  },
});

const AdminChatTopicTime = route<Actions, { chatId: number } | void>({
  id: 'admin_chat_topic_time',
  async action({ ctx, params }) {
    if (!params) {
      const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
      return {
        text: `Введите время статьи для чата ${chatId} (HH:MM):`,
        buttons: [],
      };
    }
    return {
      text: `Введите время статьи для чата ${params.chatId} (HH:MM):`,
      buttons: [],
    };
  },
  async onText({ ctx, params, text, navigate }) {
    const chatId =
      params?.chatId ??
      Number((ctx as Context & { match?: string[] }).match?.[1]);
    const date =
      ctx.message && 'date' in ctx.message
        ? new Date(ctx.message.date * 1000)
        : new Date();
    const offset = -date.getTimezoneOffset();
    const hours = Math.floor(offset / 60);
    const sign = hours >= 0 ? '+' : '-';
    const timezone = `UTC${sign}${String(Math.abs(hours)).padStart(2, '0')}`;
    await navigate(AdminChatTopicTimezone, { chatId, time: text, timezone });
  },
});

const AdminChatTopicTimezone = route<
  Actions,
  { chatId: number; time: string; timezone: string }
>({
  id: 'admin_chat_topic_timezone',
  async action({ params }) {
    const { chatId, timezone } = params;
    return {
      text: `Часовой пояс для чата ${chatId} (${timezone}). Введите другой, если нужно:`,
      buttons: [],
    };
  },
  async onText({ actions, params, text }) {
    const tz = text.trim() === '' ? params.timezone : text.trim();
    await actions.setTopicTime(params.chatId, params.time, tz);
    await actions.rescheduleTopic(params.chatId);
    return { text: '✅ Время статьи обновлено', buttons: [] };
  },
});

const ChatNotApproved = route<Actions>({
  id: 'chat_not_approved',
  async action({ actions }) {
    return {
      text: 'Этот чат не находится в списке разрешённых.',
      buttons: rows(
        row(
          button({
            text: 'Запросить доступ',
            callback: cb('chat_request'),
            action: async () => actions.requestChatAccess(),
          })
        )
      ),
    };
  },
});

const NoAccess = route<Actions>({
  id: 'no_access',
  async action({ actions }) {
    return {
      text: 'Для работы с данными нужен доступ.',
      buttons: rows(
        row(
          button({
            text: '🔑 Запросить доступ',
            callback: cb('request_access'),
            action: async () => actions.requestUserAccess(),
          })
        )
      ),
    };
  },
});

const ChatApprovalRequest = route<Actions, { name: string; chatId: number }>({
  id: 'chat_approval_request',
  async action({ params }) {
    return {
      text: `${params.name} запросил доступ`,
      buttons: rows(
        row(
          button({
            text: 'Разрешить',
            callback: cb('chat_approve', [params.chatId]),
            action: async ({ actions }) => actions.approveChat(params.chatId),
          }),
          button({
            text: 'Забанить',
            callback: cb('chat_ban', [params.chatId]),
            action: async ({ actions }) => actions.banChat(params.chatId),
          })
        )
      ),
    };
  },
});

const UserAccessRequest = route<
  Actions,
  {
    msg: string;
    chatId: number;
    userId: number;
  }
>({
  id: 'user_access_request',
  async action({ params }) {
    return {
      text: params.msg,
      buttons: rows(
        row(
          button({
            text: 'Одобрить',
            callback: cb('user_approve', [params.chatId, params.userId]),
            action: async ({ actions }) =>
              actions.approveUser(params.chatId, params.userId),
          })
        ),
        row(
          button({
            text: 'Забанить чат',
            callback: cb('chat_ban', [params.chatId]),
            action: async ({ actions }) => actions.banChat(params.chatId),
          })
        )
      ),
    };
  },
});

const ChatApprove = route<Actions>({
  id: 'chat_approve',
  async action({ ctx, actions }) {
    const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.approveChat(chatId);
  },
});

const ChatBan = route<Actions>({
  id: 'chat_ban',
  async action({ ctx, actions }) {
    const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.banChat(chatId);
  },
});

const ChatUnban = route<Actions>({
  id: 'chat_unban',
  async action({ ctx, actions }) {
    const chatId = Number((ctx as Context & { match?: string[] }).match?.[1]);
    await actions.unbanChat(chatId);
  },
});

const UserApprove = route<Actions>({
  id: 'user_approve',
  async action({ ctx, actions }) {
    const match = (ctx as Context & { match?: string[] }).match;
    const chatId = Number(match?.[1]);
    const userId = Number(match?.[2]);
    await actions.approveUser(chatId, userId);
  },
});

// eslint-disable-next-line import/no-unused-modules
export const routes = [
  {
    route: Menu,
    children: [
      {
        route: ChatSettings,
        hasBack: true,
        children: [
          ChatHistoryLimit,
          ChatInterestInterval,
          ChatTopicTime,
          ChatTopicTimezone,
        ],
      },
    ],
  },
  {
    route: AdminMenu,
    children: [
      {
        route: AdminChats,
        hasBack: true,
        children: [
          {
            route: AdminChat,
            hasBack: true,
            children: [
              AdminChatHistoryLimit,
              AdminChatInterestInterval,
              AdminChatTopicTime,
              AdminChatTopicTimezone,
            ],
          },
        ],
      },
    ],
  },
  { route: ChatNotApproved },
  { route: NoAccess },
  { route: ChatApprovalRequest },
  { route: UserAccessRequest },
  { route: ChatApprove },
  { route: ChatBan },
  { route: ChatUnban },
  { route: UserApprove },
];

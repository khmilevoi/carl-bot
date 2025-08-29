/**
 * Inline Router (fresh rewrite)
 *
 * Summary
 * - Typed routes with `action` (and optional `onText`).
 * - Views render text + inline buttons; Back/Cancel controls can be shown.
 * - Navigation via:
 *   - `bot.command(actionName)` and `bot.action(actionName)` when `actionName` is declared on a route.
 *   - Callback data (via cb/parseCb) handled by a global `bot.action`.
 * - Auto-merge `setMyCommands` from `actionName`+`options.commands`.
 * - Pluggable StateStore/TokenStore; simple in-memory defaults.
 * - Minimal DSL for building button rows.
 */

import type { Context, Telegraf } from 'telegraf';
import type {
  BotCommand,
  BotCommandScope,
  InlineKeyboardMarkup,
  Message,
} from 'telegraf/typings/core/types/typegram';

// ============================================================================
// Public API Types
// ============================================================================

export type RenderMode = 'edit' | 'replace' | 'append' | 'smart';

export type Button<A = unknown> = {
  text: string;
  callback: string;
  action?: (args: {
    ctx: Context;
    actions: A;
    navigate: NavigateFn<A>;
    navigateBack: () => Promise<void>;
  }) => Promise<void> | void;
  answer?: {
    text?: string;
    alert?: boolean;
    url?: string;
    cacheTimeSec?: number;
  };
};

export type RouteView<A = unknown> = {
  text: string;
  buttons?: Array<Button<A> | Button<A>[]>;
  disablePreview?: boolean;
  renderMode?: RenderMode;
  showBack?: boolean;
  showCancel?: boolean;
};

export type NavigateFn<A = unknown> = <NP = unknown>(
  route: Route<A, NP>,
  params?: NP
) => Promise<void>;

export type RouteActionArgs<A = unknown, P = unknown> = {
  ctx: Context;
  actions: A;
  params: P;
  navigate: NavigateFn<A>;
  navigateBack: () => Promise<void>;
  state: RouterState;
};

export type Route<A = unknown, P = unknown> = {
  id: string;
  actionName?: string;
  actionDescription?: string;
  action: (
    args: RouteActionArgs<A, P>
  ) => Promise<void | RouteView<A>> | void | RouteView<A>;
  onText?: (
    args: RouteActionArgs<A, P> & { text: string }
  ) => Promise<RouteView<A> | void> | RouteView<A> | void;
};

export type RouteNode<A = unknown> = {
  route: Route<A, unknown>;
  hasBack?: boolean;
  children?: Array<RouteNode<A> | Route<A, unknown>>;
};

export type RouterState = {
  stack: string[];
  params: Record<string, unknown>;
  awaitingTextRouteId?: string;
  messages: Array<{
    messageId: number;
    text: string;
    buttons: Button<unknown>[][];
    showBack: boolean;
    showCancel: boolean;
  }>;
};

export type StartOptions = {
  inputPrompt?: string;
  backLabel?: string;
  backCallbackData?: string;
  renderMode?: RenderMode;
  onEditFail?: 'reply' | 'replace' | 'ignore';
  errorRenderMode?: RenderMode;
  errorPrefix?: string;
  cancelLabel?: string;
  cancelCallbackData?: string;
  cancelCommands?: string[];
  showCancelOnWait?: boolean;
  cbVersion?: string;
  onError?: (err: unknown, ctx: Context, state: RouterState) => void;
  stateStore?: StateStore;
  tokenStore?: TokenStore;
  maxMessages?: number;
  commands?: BotCommand[];
  commandsExtra?: { scope?: BotCommandScope; language_code?: string };
};

// ============================================================================
// Errors & helpers
// ============================================================================

export class RouterUserError extends Error {
  view?: Partial<RouteView<unknown>>;
  constructor(message: string, view?: Partial<RouteView<unknown>>) {
    super(message);
    this.name = 'RouterUserError';
    this.view = view;
  }
}

export function getMatch(ctx: Context): readonly string[] | undefined {
  return (ctx as Context & { match?: string[] }).match;
}

// ============================================================================
// Stores
// ============================================================================

export interface StateStore {
  get(chatId: number, userId: number): Promise<RouterState | undefined>;
  set(chatId: number, userId: number, state: RouterState): Promise<void>;
  delete(chatId: number, userId: number): Promise<void>;
}

class InMemoryStateStore implements StateStore {
  private map = new Map<string, RouterState>();
  async get(chatId: number, userId: number): Promise<RouterState | undefined> {
    return this.map.get(`${chatId}:${userId}`);
  }
  async set(chatId: number, userId: number, state: RouterState): Promise<void> {
    this.map.set(`${chatId}:${userId}`, state);
  }
  async delete(chatId: number, userId: number): Promise<void> {
    this.map.delete(`${chatId}:${userId}`);
  }
}

export interface TokenStore {
  save(data: unknown, ttlMs?: number): Promise<string> | string;
  load(token: string): Promise<unknown | undefined> | unknown | undefined;
  delete?(token: string): Promise<void> | void;
}

class InMemoryTokenStore implements TokenStore {
  private map = new Map<string, { data: unknown; exp?: number }>();
  save(data: unknown, ttlMs?: number): string {
    const token = Math.random().toString(36).slice(2, 10);
    const exp = ttlMs ? Date.now() + ttlMs : undefined;
    this.map.set(token, { data, exp });
    return token;
  }
  load(token: string): unknown | undefined {
    const rec = this.map.get(token);
    if (!rec) return undefined;
    if (rec.exp && Date.now() > rec.exp) {
      this.map.delete(token);
      return undefined;
    }
    return rec.data;
  }
  delete(token: string): void {
    this.map.delete(token);
  }
}

// ============================================================================
// Callback helpers
// ============================================================================

export function cb(
  routeId: string,
  args: Array<string | number> = [],
  cbVersion = 'v1'
): string {
  const tail = args.length ? `:${args.join(':')}` : '';
  return `${routeId}!${cbVersion}${tail}`;
}

export function parseCb(data: string): {
  routeId: string;
  cbVersion?: string;
  args: string[];
  isToken: boolean;
  token?: string;
} {
  const [head, ...rest] = data.split(':');
  const [routeId, version] = head.split('!');
  if (!version)
    return { routeId: head, cbVersion: undefined, args: rest, isToken: false };
  if (rest[0] === 't')
    return {
      routeId,
      cbVersion: version,
      args: rest.slice(1),
      isToken: true,
      token: rest[1],
    };
  return { routeId, cbVersion: version, args: rest, isToken: false };
}

export async function cbTok(
  routeId: string,
  tokenStore: TokenStore,
  payload: unknown,
  ttlMs = 10 * 60_000,
  cbVersion = 'v1'
): Promise<string> {
  const token = await tokenStore.save(payload, ttlMs);
  return `${routeId}!${cbVersion}:t:${token}`;
}

// ============================================================================
// DSL
// ============================================================================

export const DSL = {
  row<A = unknown>(...btns: Button<A>[]): Button<A>[] {
    return btns;
  },
  rows<A = unknown>(
    ...lines: Array<Button<A> | Button<A>[]>
  ): Array<Button<A> | Button<A>[]> {
    return lines;
  },
};

export interface RunningRouter<A = unknown> {
  onText(fn: (ctx: Context) => Promise<void> | void): void;
  navigate(
    ctx: Context,
    route: Route<A, unknown>,
    params?: unknown
  ): Promise<void>;
  navigateBack(ctx: Context): Promise<void>;
}

const DEFAULTS: Required<
  Omit<StartOptions, 'onError' | 'stateStore' | 'tokenStore'>
> & {
  onError?: StartOptions['onError'];
  stateStore: StateStore;
  tokenStore: TokenStore;
} = {
  inputPrompt: 'Введите данные:',
  backLabel: '◀️ Назад',
  backCallbackData: '__router_back__',
  renderMode: 'smart',
  onEditFail: 'reply',
  errorRenderMode: 'append',
  errorPrefix: '⚠️ ',
  cancelLabel: '✖️ Отмена',
  cancelCallbackData: '__router_cancel__',
  cancelCommands: ['/cancel', 'Отмена', 'отмена'],
  showCancelOnWait: true,
  cbVersion: 'v1',
  onError: undefined,
  stateStore: new InMemoryStateStore(),
  tokenStore: new InMemoryTokenStore(),
  maxMessages: 10,
  commands: [],
  commandsExtra: {},
};

// ============================================================================
// Implementation (minimal)
// ============================================================================

export function createRouter<A = unknown>(
  tree: Array<RouteNode<A> | Route<A, unknown>>,
  optionsIn: StartOptions = {}
): { run: (bot: Telegraf<Context>, actions: A) => RunningRouter<A> } {
  const options = {
    ...DEFAULTS,
    ...optionsIn,
    stateStore: optionsIn.stateStore ?? DEFAULTS.stateStore,
    tokenStore: optionsIn.tokenStore ?? DEFAULTS.tokenStore,
  };

  type Entry = {
    route: Route<A, unknown>;
    parentId: string | null;
    hasBackEffective: boolean;
  };
  const entries = new Map<string, Entry>();
  const isConfigNode = (v: unknown): v is RouteNode<A> =>
    !!v && typeof v === 'object' && 'route' in (v as Record<string, unknown>);
  const ensureUnique = (id: string): void => {
    if (entries.has(id)) throw new Error(`Duplicate route id: ${id}`);
  };
  const walk = (
    node: RouteNode<A> | Route<A, unknown>,
    parentId: string | null,
    parentHasBack: boolean
  ): void => {
    const r = isConfigNode(node)
      ? (node as RouteNode<A>).route
      : (node as Route<A, unknown>);
    ensureUnique(r.id);
    const hasBackEffective = isConfigNode(node)
      ? !!(node as RouteNode<A>).hasBack
      : !!parentHasBack;
    entries.set(r.id, {
      route: r as Route<A, unknown>,
      parentId,
      hasBackEffective,
    });
    const children = isConfigNode(node)
      ? (node as RouteNode<A>).children
      : undefined;
    if (children?.length)
      for (const ch of children)
        walk(ch as RouteNode<A> | Route<A, unknown>, r.id, hasBackEffective);
  };
  for (const n of tree) walk(n, null, false);

  const getIds = (ctx: Context): { chatId: number; userId: number } => ({
    chatId: ctx.chat?.id ?? 0,
    userId: ctx.from?.id ?? 0,
  });
  const getState = async (ctx: Context): Promise<RouterState> => {
    const { chatId, userId } = getIds(ctx);
    let st = await options.stateStore.get(chatId, userId);
    if (!st) {
      st = { stack: [], params: {}, messages: [] };
      await options.stateStore.set(chatId, userId, st);
    }
    return st;
  };
  const setState = async (ctx: Context, state: RouterState): Promise<void> => {
    const { chatId, userId } = getIds(ctx);
    await options.stateStore.set(chatId, userId, state);
  };

  const ensureRows = (
    buttons?: Array<Button<A> | Button<A>[]>
  ): Button<unknown>[][] => {
    if (!buttons?.length) return [];
    const rows: Button<unknown>[][] = [];
    for (const b of buttons)
      rows.push((Array.isArray(b) ? b : [b]) as Button<unknown>[]);
    return rows;
  };
  const buildKeyboard = (
    rows: Button<unknown>[][],
    showBack: boolean,
    showCancel: boolean
  ): InlineKeyboardMarkup => {
    const inline_keyboard = rows.map((row) =>
      row.map((b) => ({ text: b.text, callback_data: b.callback }))
    );
    if (showBack || showCancel) {
      const extra: Array<{ text: string; callback_data: string }> = [];
      if (showCancel)
        extra.push({
          text: options.cancelLabel,
          callback_data: options.cancelCallbackData,
        });
      if (showBack)
        extra.push({
          text: options.backLabel,
          callback_data: options.backCallbackData,
        });
      inline_keyboard.push(extra);
    }
    return { inline_keyboard } as unknown as InlineKeyboardMarkup;
  };

  async function render(
    ctx: Context,
    view?: RouteView<A>,
    inheritedBack = false,
    inheritedCancel = false
  ): Promise<void> {
    const st = await getState(ctx);
    const rows = ensureRows(view?.buttons);
    const finalBack =
      typeof view?.showBack === 'boolean' ? view.showBack : inheritedBack;
    const finalCancel =
      typeof view?.showCancel === 'boolean' ? view.showCancel : inheritedCancel;
    const reply_markup = buildKeyboard(rows, finalBack, finalCancel);
    const sent = await ctx.reply(view?.text ?? '', {
      reply_markup,
      link_preview_options: { is_disabled: view?.disablePreview ?? true },
    });
    const mid = (sent as Message).message_id;
    if (mid) {
      const entry = {
        messageId: mid,
        text: view?.text ?? '',
        buttons: rows as Button<unknown>[][],
        showBack: finalBack,
        showCancel: finalCancel,
      };
      const idx = st.messages.findIndex((m) => m.messageId === mid);
      if (idx >= 0) st.messages[idx] = entry;
      else st.messages.push(entry);
      await setState(ctx, st);
    }
  }

  async function navigate(
    ctx: Context,
    r: Route<A, unknown>,
    params?: unknown
  ): Promise<void> {
    const st = await getState(ctx);
    st.stack.push(r.id);
    st.params[r.id] = params as unknown;
    await setState(ctx, st);
    const e = entries.get(r.id);
    if (!e) return;
    const inheritedBack = e.hasBackEffective && !!e.parentId;
    const inheritedCancel = !!r.onText && options.showCancelOnWait;
    const view = (await r.action({
      ctx,
      actions: currentActions as A,
      params: params as unknown,
      navigate: (nr, p) => navigate(ctx, nr as Route<A, unknown>, p),
      navigateBack: () => navigateBack(ctx),
      state: st,
    })) as RouteView<A> | void;
    if (view) await render(ctx, view, inheritedBack, inheritedCancel);
  }

  async function navigateBack(ctx: Context): Promise<void> {
    const st = await getState(ctx);
    st.stack.pop();
    await setState(ctx, st);
  }

  let currentActions: A | null = null;

  const api = {
    run(bot: Telegraf<Context>, actions: A): RunningRouter<A> {
      currentActions = actions;

      // setMyCommands merge
      const autos: BotCommand[] = [];
      for (const { route } of entries.values())
        if (route.actionName?.trim())
          autos.push({
            command: route.actionName,
            description: route.actionDescription ?? route.actionName,
          });
      const merged = new Map<string, BotCommand>();
      for (const c of [...(options.commands ?? []), ...autos])
        if (!merged.has(c.command)) merged.set(c.command, c);
      const final = Array.from(merged.values());
      if (final.length)
        void bot.telegram.setMyCommands(final, options.commandsExtra);

      // commands for actionName
      for (const e of entries.values()) {
        const r = e.route;
        if (r.actionName?.trim())
          bot.command(r.actionName, async (ctx) => {
            await navigate(ctx, r);
          });
        if (r.actionName?.trim())
          bot.action(r.actionName, async (ctx) => {
            await navigate(ctx, r);
            try {
              await ctx.answerCbQuery();
            } catch {
              void 0;
            }
          });
      }

      // global callback handler
      bot.action(/.*/, async (ctx) => {
        const data = (ctx as Context & { callbackQuery?: { data?: string } })
          .callbackQuery?.data as string | undefined;
        if (!data) return;
        const parsed = parseCb(data);
        (ctx as Context & { match?: string[] }).match = [data, ...parsed.args];

        const st = await getState(ctx);
        const mid = (
          ctx as Context & {
            callbackQuery?: { message?: { message_id?: number } };
          }
        ).callbackQuery?.message?.message_id;
        let matched: Button<A> | undefined;
        if (mid) {
          const found = st.messages.find((m) => m.messageId === mid);
          if (found) {
            outer1: for (const row of found.buttons as Button<A>[][]) {
              for (const b of row) {
                if (b.callback === data) {
                  matched = b;
                  break outer1;
                }
              }
            }
          }
        }
        if (!matched) {
          const last = st.messages[st.messages.length - 1];
          if (last)
            outer2: for (const row of last.buttons as Button<A>[][]) {
              for (const b of row) {
                if (b.callback === data) {
                  matched = b;
                  break outer2;
                }
              }
            }
        }

        try {
          if (matched?.answer)
            await ctx.answerCbQuery(matched.answer.text, {
              show_alert: matched.answer.alert,
              url: matched.answer.url,
              cache_time: matched.answer.cacheTimeSec,
            });
          else await ctx.answerCbQuery();
        } catch {
          void 0;
        }

        if (matched?.action) {
          await matched.action({
            ctx,
            actions: currentActions as A,
            navigate: (nr, p) => navigate(ctx, nr as Route<A, unknown>, p),
            navigateBack: () => navigateBack(ctx),
          });
          return;
        }

        const rid = parsed.routeId;
        const e = entries.get(rid);
        if (e) await navigate(ctx, e.route);
      });

      let onTextFallback: ((ctx: Context) => Promise<void> | void) | null =
        null;
      void onTextFallback;
      return {
        onText(fn: (ctx: Context) => Promise<void> | void): void {
          onTextFallback = fn;
        },
        navigate: (ctx: Context, route: Route<A, unknown>, params?: unknown) =>
          navigate(ctx, route, params),
        navigateBack: (ctx: Context) => navigateBack(ctx),
      };
    },
  };

  return api;
}

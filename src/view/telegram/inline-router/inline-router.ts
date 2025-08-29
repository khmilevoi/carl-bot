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
 *
 * Render modes
 * - `append`: always send a new message via `ctx.reply`; previous messages are kept until `maxMessages` pruning.
 * - `replace`: delete the last known router message (or the callback message) and send a new one via `ctx.reply`.
 * - `edit`: edit the callback-origin message via `ctx.editMessageText`; if edit fails, fallback is controlled by `onEditFail`.
 * - `smart` (default): if invoked from a callback on a message we previously rendered, try `edit`; otherwise `append`.
 *   - When using `smart`, a no-op is performed if the text and buttons are unchanged (debounce redundant edits).
 *
 * Edit failure policy (`onEditFail`)
 * - `reply` (default): fall back to sending a new message.
 * - `replace`: delete the previous message and then send a new one.
 * - `ignore`: do nothing on edit failure.
 *
 * Error handling
 * - Throw `RouterUserError` to present a friendly error to the user. Its `view` can override text/buttons/renderMode.
 * - All other errors are rendered with `errorPrefix` and `errorRenderMode`; `onError` hook is invoked for logging.
 */
import type { Context, Telegraf } from 'telegraf';
import type {
  BotCommand,
  BotCommandScope,
  InlineKeyboardMarkup,
  Message,
} from 'telegraf/typings/core/types/typegram';

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

export type NavigateFn<A = unknown> = <NP = void>(
  route: Route<A, NP>,
  ...p: NP extends void ? [] : [params: NP]
) => Promise<void>;

export type RouteActionArgs<A = unknown, P = void> = {
  ctx: Context;
  actions: A;
  params: P;
  navigate: NavigateFn<A>;
  navigateBack: () => Promise<void>;
  state: RouterState;
};

export type Route<A = unknown, P = void> = {
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
  navigate<P = void>(
    ctx: Context,
    route: Route<A, P>,
    ...p: P extends void ? [] : [params: P]
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

function isConfigNode<A>(v: unknown): v is RouteNode<A> {
  return (
    !!v && typeof v === 'object' && 'route' in (v as Record<string, unknown>)
  );
}

class SimpleMutex {
  private queue = new Map<string, Promise<void>>();
  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queue.get(key) ?? Promise.resolve();
    let release!: () => void;
    const cur = new Promise<void>((resolve) => (release = resolve));
    this.queue.set(key, cur);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.queue.get(key) === cur) this.queue.delete(key);
    }
  }
}

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
  const walk = (
    node: RouteNode<A> | Route<A, unknown>,
    parentId: string | null,
    parentHasBack: boolean
  ): void => {
    const r = isConfigNode(node)
      ? (node as RouteNode<A>).route
      : (node as Route<A, unknown>);
    if (entries.has(r.id)) throw new Error(`Duplicate route id: ${r.id}`);
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

  const mutex = new SimpleMutex();

  const getIds = (ctx: Context): { chatId: number; userId: number } => ({
    chatId: ctx.chat?.id ?? 0,
    userId: ctx.from?.id ?? 0,
  });
  const getKey = (ctx: Context): string => {
    const { chatId, userId } = getIds(ctx);
    return `${chatId}:${userId}`;
  };
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

  const getEntry = (rid?: string): Entry | undefined =>
    rid ? entries.get(rid) : undefined;
  const topRouteId = (st: RouterState): string | undefined =>
    st.stack[st.stack.length - 1];

  const rowsFrom = (
    buttons?: Array<Button<A> | Button<A>[]>
  ): Button<unknown>[][] => {
    if (!buttons?.length) return [];
    const rows: Button<unknown>[][] = [];
    for (const b of buttons)
      rows.push((Array.isArray(b) ? b : [b]) as Button<unknown>[]);
    return rows;
  };
  const buttonsEqual = (
    l: Button<unknown>[][],
    r: Button<unknown>[][]
  ): boolean => {
    if (l.length !== r.length) return false;
    for (let i = 0; i < l.length; i++) {
      if (l[i].length !== r[i].length) return false;
      for (let j = 0; j < l[i].length; j++) {
        if (
          l[i][j].text !== r[i][j].text ||
          l[i][j].callback !== r[i][j].callback
        )
          return false;
      }
    }
    return true;
  };
  const keyboard = (
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

  async function pruneOverflow(ctx: Context, st: RouterState): Promise<void> {
    const limit = options.maxMessages;
    const overflow = Math.max(0, st.messages.length - limit);
    if (overflow <= 0) return;
    const drop = st.messages.slice(0, overflow);
    for (const m of drop) {
      try {
        await ctx.deleteMessage(m.messageId);
      } catch {
        /* noop */
      }
    }
    st.messages = st.messages.slice(overflow);
    await setState(ctx, st);
  }

  async function render(
    ctx: Context,
    view: RouteView<A> | undefined,
    inheritedBack: boolean,
    inheritedCancel: boolean
  ): Promise<void> {
    const st = await getState(ctx);
    const rows = rowsFrom(view?.buttons);
    const showBack =
      typeof view?.showBack === 'boolean' ? view.showBack : inheritedBack;
    const showCancel =
      typeof view?.showCancel === 'boolean' ? view.showCancel : inheritedCancel;
    const reply_markup = keyboard(rows, showBack, showCancel);
    const mode: RenderMode = (view?.renderMode ??
      options.renderMode) as RenderMode;
    const mid = (
      ctx as Context & { callbackQuery?: { message?: { message_id?: number } } }
    ).callbackQuery?.message?.message_id;
    const remember = async (messageId: number): Promise<void> => {
      const entry = {
        messageId,
        text: view?.text ?? '',
        buttons: rows as Button<unknown>[][],
        showBack,
        showCancel,
      };
      const i = st.messages.findIndex((m) => m.messageId === messageId);
      if (i >= 0) st.messages[i] = entry;
      else st.messages.push(entry);
      await setState(ctx, st);
      await pruneOverflow(ctx, st);
    };

    if (mode === 'append') {
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    if (mode === 'replace') {
      const target = mid ?? st.messages[st.messages.length - 1]?.messageId;
      if (target) {
        try {
          await ctx.deleteMessage(target);
          st.messages = st.messages.filter((m) => m.messageId !== target);
          await setState(ctx, st);
        } catch {
          /* noop */
        }
      }
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    if (mode === 'smart' && mid) {
      const prev = st.messages.find((m) => m.messageId === mid);
      if (
        prev &&
        prev.text === (view?.text ?? '') &&
        buttonsEqual(prev.buttons, rows) &&
        prev.showBack === showBack &&
        prev.showCancel === showCancel
      )
        return;
      try {
        await ctx.editMessageText(view?.text ?? '', {
          reply_markup,
          link_preview_options: { is_disabled: view?.disablePreview ?? true },
        });
        await remember(mid);
        return;
      } catch {
        /* noop */
      }
      if (options.onEditFail === 'replace') {
        try {
          await ctx.deleteMessage(mid);
          st.messages = st.messages.filter((m) => m.messageId !== mid);
          await setState(ctx, st);
        } catch {
          /* noop */
        }
      } else if (options.onEditFail === 'ignore') {
        return;
      }
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    if (mode === 'edit' && mid) {
      try {
        await ctx.editMessageText(view?.text ?? '', {
          reply_markup,
          link_preview_options: { is_disabled: view?.disablePreview ?? true },
        });
        await remember(mid);
        return;
      } catch {
        /* noop */
      }
      if (options.onEditFail === 'replace') {
        try {
          await ctx.deleteMessage(mid);
          st.messages = st.messages.filter((m) => m.messageId !== mid);
          await setState(ctx, st);
        } catch {
          /* noop */
        }
      } else if (options.onEditFail === 'ignore') {
        return;
      }
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    const sent = await ctx.reply(view?.text ?? '', {
      reply_markup,
      link_preview_options: { is_disabled: view?.disablePreview ?? true },
    });
    const id = (sent as Message).message_id;
    if (id) await remember(id);
  }

  async function _navigate<NP = unknown>(
    ctx: Context,
    r: Route<A, NP>,
    params?: NP
  ): Promise<void> {
    const st = await getState(ctx);
    st.stack.push(r.id);
    st.params[r.id] = params as unknown;
    st.awaitingTextRouteId = undefined;
    await setState(ctx, st);
    const e = getEntry(r.id);
    if (!e) return;
    const inheritedBack = e.hasBackEffective && !!e.parentId;
    const inheritedCancel = !!r.onText && options.showCancelOnWait;
    try {
      const view = (await r.action({
        ctx,
        actions: currentActions as A,
        params: params as NP,
        navigate: (nr, p) => _navigate(ctx, nr as Route<A, unknown>, p),
        navigateBack: () => _navigateBack(ctx),
        state: st,
      })) as RouteView<A> | void;
      if (view) await render(ctx, view, inheritedBack, inheritedCancel);
      else if (r.onText)
        await render(
          ctx,
          { text: options.inputPrompt, buttons: [] },
          inheritedBack,
          true
        );
      if (r.onText) {
        st.awaitingTextRouteId = r.id;
        await setState(ctx, st);
      }
    } catch (err) {
      await handleError(ctx, err, inheritedBack, !!r.onText);
    }
  }

  async function _navigateBack(ctx: Context): Promise<void> {
    const st = await getState(ctx);
    st.stack.pop();
    st.awaitingTextRouteId = undefined;
    await setState(ctx, st);
    const cur = topRouteId(st);
    if (!cur) {
      try {
        await ctx.editMessageReplyMarkup(undefined);
      } catch {
        /* noop */
      }
      return;
    }
    const e = getEntry(cur);
    if (!e) return;
    const r = e.route;
    const inheritedBack = e.hasBackEffective && !!e.parentId;
    const inheritedCancel = !!r.onText && options.showCancelOnWait;
    try {
      const view = (await r.action({
        ctx,
        actions: currentActions as A,
        params: st.params[cur],
        navigate: (nr, p) => _navigate(ctx, nr as Route<A, unknown>, p),
        navigateBack: () => _navigateBack(ctx),
        state: st,
      })) as RouteView<A> | void;
      if (view) await render(ctx, view, inheritedBack, inheritedCancel);
      else if (r.onText) {
        await render(
          ctx,
          { text: options.inputPrompt, buttons: [] },
          inheritedBack,
          true
        );
        st.awaitingTextRouteId = r.id;
        await setState(ctx, st);
      }
    } catch (err) {
      await handleError(ctx, err, inheritedBack, !!r.onText);
    }
  }

  async function _cancelWait(ctx: Context): Promise<void> {
    const st = await getState(ctx);
    if (st.awaitingTextRouteId) {
      const rid = st.awaitingTextRouteId;
      if (rid === topRouteId(st)) st.stack.pop();
      st.awaitingTextRouteId = undefined;
      await setState(ctx, st);
    }
    await _navigateBack(ctx);
  }

  async function handleError(
    ctx: Context,
    err: unknown,
    inheritedBack: boolean,
    awaiting: boolean
  ): Promise<void> {
    const st = await getState(ctx);
    options.onError?.(err, ctx, st);
    if (err instanceof RouterUserError) {
      const v: RouteView<unknown> = {
        text: (err.view?.text ??
          `${options.errorPrefix}${err.message}`) as string,
        buttons:
          (err.view?.buttons as
            | Button<unknown>[]
            | Button<unknown>[][]
            | undefined) ?? [],
        disablePreview:
          (err.view?.disablePreview as boolean | undefined) ?? true,
        renderMode:
          (err.view?.renderMode as RenderMode | undefined) ??
          options.errorRenderMode,
      };
      await render(
        ctx,
        v as RouteView<A>,
        inheritedBack,
        awaiting && options.showCancelOnWait
      );
      return;
    }
    const v: RouteView<unknown> = {
      text: `${options.errorPrefix}Неизвестная ошибка`,
      buttons: [],
      renderMode: options.errorRenderMode,
    };
    await render(
      ctx,
      v as RouteView<A>,
      inheritedBack,
      awaiting && options.showCancelOnWait
    );
  }

  let currentActions: A | null = null;

  return {
    run(bot: Telegraf<Context>, actions: A): RunningRouter<A> {
      currentActions = actions;

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

      for (const e of entries.values()) {
        const r = e.route;
        if (r.actionName?.trim())
          bot.command(r.actionName, async (ctx) => {
            await mutex.runExclusive(getKey(ctx), async () => {
              await _navigate(ctx, r);
            });
          });
        if (r.actionName?.trim())
          bot.action(r.actionName, async (ctx) => {
            await mutex.runExclusive(getKey(ctx), async () => {
              await _navigate(ctx, r);
              try {
                await ctx.answerCbQuery();
              } catch {
                /* noop */
              }
            });
          });
      }

      bot.action(/^[\s\S]+$/, async (ctx) => {
        await mutex.runExclusive(getKey(ctx), async () => {
          const data = (ctx as Context & { callbackQuery?: { data?: string } })
            .callbackQuery?.data as string | undefined;
          if (!data) return;
          const parsed = parseCb(data);
          (ctx as Context & { match?: string[] }).match = [
            data,
            ...parsed.args,
          ];

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
            if (last) {
              outer2: for (const row of last.buttons as Button<A>[][]) {
                for (const b of row) {
                  if (b.callback === data) {
                    matched = b;
                    break outer2;
                  }
                }
              }
            }
          }

          try {
            if (matched?.answer) {
              await ctx.answerCbQuery(matched.answer.text, {
                show_alert: matched.answer.alert,
                url: matched.answer.url,
                cache_time: matched.answer.cacheTimeSec,
              });
            } else {
              await ctx.answerCbQuery();
            }
          } catch {
            /* noop */
          }

          if (data === options.cancelCallbackData) {
            await _cancelWait(ctx);
            return;
          }
          if (data === options.backCallbackData) {
            await _navigateBack(ctx);
            return;
          }

          if (matched?.action) {
            try {
              await matched.action({
                ctx,
                actions: currentActions as A,
                navigate: (nr, p) => _navigate(ctx, nr as Route<A, unknown>, p),
                navigateBack: () => _navigateBack(ctx),
              });
            } catch (err) {
              const curId = topRouteId(st);
              if (curId) {
                const entry = getEntry(curId);
                const inheritedBack =
                  !!entry?.hasBackEffective && !!entry?.parentId;
                await handleError(ctx, err, inheritedBack, false);
              } else {
                await handleError(ctx, err, false, false);
              }
            }
            return;
          }

          const rid = parsed.routeId;
          const e = getEntry(rid);
          if (e) {
            await _navigate(ctx, e.route);
            return;
          }
        });
      });

      bot.on('text', async (ctx, next) => {
        await mutex.runExclusive(getKey(ctx), async () => {
          const st = await getState(ctx);
          const rid = st.awaitingTextRouteId;
          const text = (
            ctx as Context & { message?: { text?: string } }
          ).message?.text?.trim();
          if (!rid) {
            if (next) await next();
            return;
          }
          if (
            text &&
            (options.cancelCommands ?? []).some(
              (c) => c.toLowerCase() === text.toLowerCase()
            )
          ) {
            await _cancelWait(ctx);
            return;
          }
          const e = getEntry(rid);
          if (!e) {
            st.awaitingTextRouteId = undefined;
            await setState(ctx, st);
            if (next) await next();
            return;
          }
          const r = e.route;
          try {
            if (r.onText) {
              const res = await r.onText({
                ctx,
                actions: currentActions as A,
                params: st.params[rid],
                navigate: (nr, p) => _navigate(ctx, nr as Route<A, unknown>, p),
                navigateBack: () => _navigateBack(ctx),
                state: st,
                text: text ?? '',
              });
              if (res) {
                await render(
                  ctx,
                  res as RouteView<A>,
                  e.hasBackEffective && !!e.parentId,
                  false
                );
                st.awaitingTextRouteId = undefined;
                await setState(ctx, st);
              } else {
                st.awaitingTextRouteId = undefined;
                await setState(ctx, st);
                await _navigateBack(ctx);
              }
            } else {
              st.awaitingTextRouteId = undefined;
              await setState(ctx, st);
              if (next) await next();
            }
          } catch (err) {
            const inheritedBack = e.hasBackEffective && !!e.parentId;
            await handleError(ctx, err, inheritedBack, true);
          }
        });
      });

      let onTextFallback: ((ctx: Context) => Promise<void> | void) | null =
        null;
      bot.on('text', async (ctx) => {
        const st = await getState(ctx);
        if (st.awaitingTextRouteId) return;
        if (onTextFallback) await onTextFallback(ctx);
      });

      return {
        onText(fn: (ctx: Context) => Promise<void> | void): void {
          onTextFallback = fn;
        },
        navigate: (ctx: Context, route: Route<A, unknown>, params?: unknown) =>
          mutex.runExclusive(getKey(ctx), () => _navigate(ctx, route, params)),
        navigateBack: (ctx: Context) =>
          mutex.runExclusive(getKey(ctx), () => _navigateBack(ctx)),
      };
    },
  };
}

/**
 * Inline Router runtime: registers handlers and routes, manages state, and renders views.
 */
import type { Context, Telegraf } from 'telegraf';
import type { BotCommand } from 'telegraf/typings/core/types/typegram';

import { DEFAULTS, type ResolvedOptions } from './defaults';
import { RouterUserError } from './errors';
import { parseCb } from './helpers';
import { SimpleMutex } from './mutex';
import { createRenderer } from './render';
import type {
  Button,
  RenderMode,
  Route,
  RouteNode,
  RouterState,
  RouteView,
  RunningRouter,
  StartOptions,
} from './types';

function isConfigNode<A>(v: unknown): v is RouteNode<A> {
  return (
    !!v && typeof v === 'object' && 'route' in (v as Record<string, unknown>)
  );
}

export function createRouter<A = unknown>(
  tree: Array<RouteNode<A> | Route<A, unknown>>,
  optionsIn: StartOptions = {}
): { run: (bot: Telegraf<Context>, actions: A) => RunningRouter<A> } {
  const options: ResolvedOptions = {
    ...DEFAULTS,
    ...optionsIn,
    stateStore: optionsIn.stateStore ?? DEFAULTS.stateStore,
    tokenStore: optionsIn.tokenStore ?? DEFAULTS.tokenStore,
  } as ResolvedOptions;

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
      st = { stack: [], params: {}, messages: [] } as RouterState;
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

  const { render } = createRenderer<A>(options, getState, setState);

  async function _navigate<NP = unknown>(
    ctx: Context,
    r: Route<A, NP>,
    params?: NP
  ): Promise<void> {
    const st = await getState(ctx);
    st.stack.push(r.id);
    Reflect.set(st.params, r.id, params as unknown);
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
        params: Reflect.get(st.params, cur) as unknown,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buttons: (err.view?.buttons as any) ?? [],
        disablePreview:
          (err.view?.disablePreview as boolean | undefined) ?? true,
        renderMode:
          (err.view?.renderMode as RenderMode | undefined) ??
          options.errorRenderMode,
      } as RouteView<unknown>;
      await render(
        ctx,
        v as RouteView<A>,
        inheritedBack,
        awaiting && options.showCancelOnWait
      );
      return;
    }
    const v2: RouteView<unknown> = {
      text: `${options.errorPrefix}�������⭠� �訡��`,
      buttons: [],
      renderMode: options.errorRenderMode,
    };
    await render(
      ctx,
      v2 as RouteView<A>,
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
                params: Reflect.get(st.params, rid) as unknown,
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

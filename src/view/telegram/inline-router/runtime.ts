import type { Context, Telegraf } from 'telegraf';
import type { BotCommand } from 'telegraf/typings/core/types/typegram';

import type { ResolvedOptions } from './defaults';
import { RouterUserError } from './errors';
import { parseCb } from './helpers';
import type { SimpleMutex } from './mutex';
import type {
  Button,
  ContextWithCallbackQuery,
  ContextWithMatch,
  ContextWithMessage,
  RenderMode,
  Route,
  RouterState,
  RouteView,
  RunningRouter,
} from './types';
import { topRouteId } from './utils';

export type Entry<A> = {
  route: Route<A, unknown>;
  parentId: string | null;
  hasBackEffective: boolean;
};

type RuntimeDeps<A> = {
  options: ResolvedOptions;
  entries: Map<string, Entry<A>>;
  mutex: SimpleMutex;
  getKey: (ctx: Context) => string;
  getState: (ctx: Context) => Promise<RouterState>;
  setState: (ctx: Context, st: RouterState) => Promise<void>;
  render: (
    ctx: Context,
    view: RouteView<A> | undefined,
    inheritedBack: boolean,
    inheritedCancel: boolean
  ) => Promise<void>;
};

// Factories for internal runtime pieces
function createHandleError<A>(deps: RuntimeDeps<A>) {
  const { options, getState, render } = deps;
  return async function handleError(
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
        buttons: (err.view?.buttons as Button<A>[][]) ?? [],
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
      text: `${options.errorPrefix}${options.errorDefaultText}`,
      buttons: [],
      renderMode: options.errorRenderMode,
    };
    await render(
      ctx,
      v2 as RouteView<A>,
      inheritedBack,
      awaiting && options.showCancelOnWait
    );
  };
}

function createNavigate<A>(
  deps: RuntimeDeps<A>,
  actions: A,
  handleError: ReturnType<typeof createHandleError<A>>,
  navigateBack: (ctx: Context) => Promise<void>
) {
  const { getState, setState, render, options, entries } = deps;
  const getEntry = (rid?: string): Entry<A> | undefined =>
    rid ? entries.get(rid) : undefined;
  return async function navigate<NP = unknown>(
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
        actions,
        params: params as NP,
        navigate: (nr, ...p) => navigate(ctx, nr as Route<A, unknown>, ...p),
        navigateBack: () => navigateBack(ctx),
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
  };
}

function createNavigateBack<A>(
  deps: RuntimeDeps<A>,
  actions: A,
  handleError: ReturnType<typeof createHandleError<A>>,
  navigate: ReturnType<typeof createNavigate<A>>
) {
  const { getState, setState, render, options, entries } = deps;
  const getEntry = (rid?: string): Entry<A> | undefined =>
    rid ? entries.get(rid) : undefined;
  return async function navigateBack(ctx: Context): Promise<void> {
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
        actions,
        params: Reflect.get(st.params, cur) as unknown,
        navigate: (nr, ...p) => navigate(ctx, nr as Route<A, unknown>, ...p),
        navigateBack: () => navigateBack(ctx),
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
  };
}

function createCancelWait<A>(
  deps: RuntimeDeps<A>,
  navigateBack: (ctx: Context) => Promise<void>
) {
  const { getState, setState } = deps;
  return async function cancelWait(ctx: Context): Promise<void> {
    const st = await getState(ctx);
    if (st.awaitingTextRouteId) {
      const rid = st.awaitingTextRouteId;
      const currentTopId = topRouteId(st);

      // Only pop from stack if awaiting route is on top
      if (rid === currentTopId) {
        st.stack.pop();
      }
      // If awaiting route is not on top, find and remove it from stack
      else {
        const index = st.stack.findIndex((id) => id === rid);
        if (index !== -1) {
          st.stack.splice(index, 1);
        }
      }

      st.awaitingTextRouteId = undefined;
      await setState(ctx, st);
    }
    await navigateBack(ctx);
  };
}

// Helper functions for button matching
function findButtonInRows<A>(
  rows: Button<A>[][],
  data: string
): Button<A> | undefined {
  for (const row of rows) {
    for (const b of row) {
      if (b.callback === data) {
        return b;
      }
    }
  }
  return undefined;
}

function findMatchedButton<A>(
  state: RouterState,
  messageId: number | undefined,
  data: string
): Button<A> | undefined {
  // First try to find button in specific message
  if (messageId) {
    const found = state.messages.find((m) => m.messageId === messageId);
    if (found) {
      const matched = findButtonInRows(found.buttons as Button<A>[][], data);
      if (matched) return matched;
    }
  }

  // Fallback to last message
  const last = state.messages[state.messages.length - 1];
  if (last) {
    return findButtonInRows(last.buttons as Button<A>[][], data);
  }

  return undefined;
}

async function handleButtonAnswer(
  ctx: Context,
  button?: Button<unknown>
): Promise<void> {
  try {
    if (button?.answer) {
      await ctx.answerCbQuery(button.answer.text, {
        show_alert: button.answer.alert,
        url: button.answer.url,
        cache_time: button.answer.cacheTimeSec,
      });
    } else {
      await ctx.answerCbQuery();
    }
  } catch {
    /* noop */
  }
}

function createGlobalActionHandler<A>(
  deps: RuntimeDeps<A>,
  actions: A,
  navigate: ReturnType<typeof createNavigate<A>>,
  navigateBack: ReturnType<typeof createNavigateBack<A>>,
  handleError: ReturnType<typeof createHandleError<A>>,
  cancelWait: (ctx: Context) => Promise<void>
) {
  const { getKey, getState, mutex, options, entries } = deps;
  const getEntry = (rid?: string): Entry<A> | undefined =>
    rid ? entries.get(rid) : undefined;

  return async function actionHandler(ctx: Context): Promise<void> {
    await mutex.runExclusive(getKey(ctx), async () => {
      const callbackCtx = ctx as ContextWithCallbackQuery;
      const data = callbackCtx.callbackQuery?.data;
      if (!data) return;

      const parsed = parseCb(data);
      (ctx as ContextWithMatch).match = [data, ...parsed.args];

      const st = await getState(ctx);
      const mid = callbackCtx.callbackQuery?.message?.message_id;

      const matched = findMatchedButton<A>(st, mid, data);
      await handleButtonAnswer(ctx, matched as Button<unknown>);

      // Handle special system callbacks
      if (data === options.cancelCallbackData) {
        await cancelWait(ctx);
        return;
      }
      if (data === options.backCallbackData) {
        await navigateBack(ctx);
        return;
      }

      // Handle button action
      if (matched?.action) {
        try {
          await matched.action({
            ctx,
            actions,
            navigate: (nr, ...p) =>
              navigate(ctx, nr as Route<A, unknown>, ...p),
            navigateBack: () => navigateBack(ctx),
          });
        } catch (err) {
          const curId = topRouteId(st);
          const e = curId ? getEntry(curId) : undefined;
          const inheritedBack = !!e?.hasBackEffective && !!e?.parentId;
          await handleError(ctx, err, inheritedBack, false);
        }
        return;
      }

      // Handle route navigation
      const rid = parsed.routeId;
      const e = getEntry(rid);
      if (e) {
        await navigate(ctx, e.route);
      }
    });
  };
}

function createTextHandler<A>(
  deps: RuntimeDeps<A>,
  actions: A,
  navigate: ReturnType<typeof createNavigate<A>>,
  navigateBack: ReturnType<typeof createNavigateBack<A>>,
  handleError: ReturnType<typeof createHandleError<A>>,
  cancelWait: (ctx: Context) => Promise<void>
) {
  const { mutex, getKey, getState, setState, options, entries, render } = deps;
  const getEntry = (rid?: string): Entry<A> | undefined =>
    rid ? entries.get(rid) : undefined;
  return async function textHandler(
    ctx: Context,
    next?: () => Promise<void> | void
  ): Promise<void> {
    await mutex.runExclusive(getKey(ctx), async () => {
      const st = await getState(ctx);
      const rid = st.awaitingTextRouteId;
      const text = (ctx as ContextWithMessage).message?.text?.trim();
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
        await cancelWait(ctx);
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
            actions,
            params: Reflect.get(st.params, rid) as unknown,
            navigate: (nr, ...p) =>
              navigate(ctx, nr as Route<A, unknown>, ...p),
            navigateBack: () => navigateBack(ctx),
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
            await navigateBack(ctx);
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
  };
}

export function createRun<A>(
  deps: RuntimeDeps<A>
): (bot: Telegraf<Context>, actions: A) => RunningRouter<A> {
  const { options, entries, mutex, getKey, getState } = deps;
  return function run(bot: Telegraf<Context>, actions: A): RunningRouter<A> {
    const handleError = createHandleError<A>(deps);

    // Forward declaration for mutual recursion
    const navigate: <NP = unknown>(
      ctx: Context,
      r: Route<A, NP>,
      params?: NP
    ) => Promise<void> = createNavigate<A>(
      deps,
      actions,
      handleError,
      (ctx: Context): Promise<void> => navigateBack(ctx)
    );
    const navigateBack: (ctx: Context) => Promise<void> = createNavigateBack<A>(
      deps,
      actions,
      handleError,
      navigate
    );
    const cancelWait = createCancelWait<A>(deps, navigateBack);

    // Register commands and actions
    const autos: BotCommand[] = [];
    for (const { route } of Array.from(entries.values()))
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

    for (const e of Array.from(entries.values())) {
      const r = e.route;
      if (r.actionName?.trim()) {
        bot.command(r.actionName, async (ctx) => {
          await mutex.runExclusive(getKey(ctx), async () => {
            await navigate(ctx, r);
          });
        });
      }
    }

    const actionHandler = createGlobalActionHandler<A>(
      deps,
      actions,
      navigate,
      navigateBack,
      handleError,
      cancelWait
    );
    bot.action(/^[\s\S]+$/, actionHandler);

    const textHandler = createTextHandler<A>(
      deps,
      actions,
      navigate,
      navigateBack,
      handleError,
      cancelWait
    );
    bot.on('text', async (ctx, next) => {
      await textHandler(ctx as Context, next);
    });

    const onTextFallbacks = new Set<(ctx: Context) => Promise<void> | void>();
    bot.on('text', async (ctx) => {
      const st = await getState(ctx);
      if (st.awaitingTextRouteId) return;
      if (onTextFallbacks.size) {
        for (const fn of Array.from(onTextFallbacks)) await fn(ctx);
      }
    });

    return {
      onText(fn: (ctx: Context) => Promise<void> | void): () => void {
        onTextFallbacks.add(fn);
        return () => {
          onTextFallbacks.delete(fn);
        };
      },
      navigate: (ctx: Context, route: Route<A, unknown>, params?: unknown) =>
        mutex.runExclusive(getKey(ctx), () => navigate(ctx, route, params)),
      navigateBack: (ctx: Context) =>
        mutex.runExclusive(getKey(ctx), () => navigateBack(ctx)),
    };
  };
}

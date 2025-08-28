import type { Context, Telegraf } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';

import { parseCb } from './callbacks';
import { DEFAULTS } from './config';
import { RouterUserError } from './errors';
import { buildKeyboardMarkup, buttonsEqual, ensureRows } from './keyboard';
import { SimpleMutex } from './mutex';
import type {
  Button,
  NavigateFn,
  RenderMode,
  Route,
  RouteActionArgs,
  RouteNode,
  RouterState,
  RouteView,
  RunningRouter,
  StartOptions,
} from './types';

function isConfigNode<A>(maybeNode: unknown): maybeNode is RouteNode<A> {
  return (
    !!maybeNode &&
    typeof maybeNode === 'object' &&
    'route' in (maybeNode as Record<string, unknown>)
  );
}

export function createRouter<A = unknown>(
  tree: Array<RouteNode<A> | Route<A, unknown>>,
  optionsIn: StartOptions = {}
): {
  run: (bot: Telegraf<Context>, actions: A) => RunningRouter<A>;
} {
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

  const ensureUnique = (routeId: string): void => {
    if (entries.has(routeId)) throw new Error(`Duplicate route id: ${routeId}`);
  };

  const walk = (
    node: RouteNode<A> | Route<A, unknown>,
    parentId: string | null,
    parentHasBackEffective: boolean
  ): void => {
    const route: Route<A, unknown> = isConfigNode<A>(node)
      ? (node as RouteNode<A>).route
      : (node as Route<A, unknown>);
    const id = route.id;
    ensureUnique(id);

    const hasBackEffective = isConfigNode<A>(node)
      ? !!((node as RouteNode<A>).hasBack ?? false)
      : !!parentHasBackEffective;

    entries.set(id, { route, parentId, hasBackEffective });

    const children = isConfigNode<A>(node)
      ? (node as RouteNode<A>).children
      : undefined;
    if (children?.length) {
      for (const child of children)
        walk(child as RouteNode<A> | Route<A, unknown>, id, hasBackEffective);
    }
  };

  for (const node of tree) walk(node, null, false);

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
    let state = await options.stateStore.get(chatId, userId);
    if (!state) {
      state = { stack: [], params: {}, messages: [] };
      await options.stateStore.set(chatId, userId, state);
    }
    return state;
  };
  const setState = async (ctx: Context, state: RouterState): Promise<void> => {
    const { chatId, userId } = getIds(ctx);
    await options.stateStore.set(chatId, userId, state);
  };

  const getEntry = (routeId?: string): Entry | undefined =>
    routeId ? entries.get(routeId) : undefined;
  const getCurrentRouteId = (state: RouterState): string | undefined =>
    state.stack[state.stack.length - 1];

  const pruneOverflow = async (
    ctx: Context,
    st: RouterState
  ): Promise<void> => {
    const limit = options.maxMessages;
    const overflow = Math.max(0, st.messages.length - limit);
    if (overflow <= 0) return;
    const toDrop = st.messages.slice(0, overflow);
    for (const m of toDrop) {
      try {
        await ctx.deleteMessage(m.messageId);
      } catch {
        /* ignore */
      }
    }
    st.messages = st.messages.slice(overflow);
    await setState(ctx, st);
  };

  async function renderView(
    ctx: Context,
    view: RouteView<A> | undefined,
    inheritedShowBack: boolean,
    inheritedShowCancel: boolean
  ): Promise<void> {
    const state = await getState(ctx);
    const rows = ensureRows(view?.buttons);

    const finalBack =
      typeof view?.showBack === 'boolean' ? view.showBack : inheritedShowBack;
    const finalCancel =
      typeof view?.showCancel === 'boolean'
        ? view.showCancel
        : inheritedShowCancel;

    const keyboardMarkup = buildKeyboardMarkup(rows, finalBack, finalCancel, {
      backLabel: options.backLabel,
      backCallbackData: options.backCallbackData,
      cancelLabel: options.cancelLabel,
      cancelCallbackData: options.cancelCallbackData,
    });
    const mode: RenderMode = (view?.renderMode ??
      options.renderMode) as RenderMode;

    const remember = async (messageId: number): Promise<void> => {
      const entry = {
        messageId,
        text: view?.text ?? '',
        buttons: rows as Button<unknown>[][],
        showBack: finalBack,
        showCancel: finalCancel,
      };
      const idx = state.messages.findIndex((m) => m.messageId === messageId);
      if (idx >= 0) state.messages[idx] = entry;
      else state.messages.push(entry);
      await setState(ctx, state);
      await pruneOverflow(ctx, state);
    };

    if (mode === 'append') {
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    if (mode === 'replace') {
      const mid = (
        ctx as Context & {
          callbackQuery?: { message?: { message_id?: number } };
        }
      ).callbackQuery?.message?.message_id;
      const targetId =
        mid ?? state.messages[state.messages.length - 1]?.messageId;
      if (targetId) {
        try {
          await ctx.deleteMessage(targetId);
          state.messages = state.messages.filter(
            (m) => m.messageId !== targetId
          );
          await setState(ctx, state);
        } catch {
          /* ignore */
        }
      }
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    const mid = (
      ctx as Context & { callbackQuery?: { message?: { message_id?: number } } }
    ).callbackQuery?.message?.message_id;

    if (mode === 'smart' && mid) {
      const prev = state.messages.find((m) => m.messageId === mid);
      if (
        prev &&
        prev.text === (view?.text ?? '') &&
        buttonsEqual(prev.buttons, rows) &&
        prev.showBack === finalBack &&
        prev.showCancel === finalCancel
      ) {
        return;
      }
      try {
        await ctx.editMessageText(view?.text ?? '', {
          reply_markup: keyboardMarkup,
          link_preview_options: { is_disabled: view?.disablePreview ?? true },
        });
        await remember(mid);
        return;
      } catch {
        // fall through based on onEditFail
      }
      if (options.onEditFail === 'replace') {
        try {
          await ctx.deleteMessage(mid);
          state.messages = state.messages.filter((m) => m.messageId !== mid);
          await setState(ctx, state);
        } catch {
          /* ignore */
        }
      } else if (options.onEditFail === 'ignore') {
        return;
      }
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    if (mode === 'edit') {
      if (mid) {
        try {
          await ctx.editMessageText(view?.text ?? '', {
            reply_markup: keyboardMarkup,
            link_preview_options: { is_disabled: view?.disablePreview ?? true },
          });
          await remember(mid);
          return;
        } catch {
          if (options.onEditFail === 'replace') {
            try {
              await ctx.deleteMessage(mid);
              state.messages = state.messages.filter(
                (m) => m.messageId !== mid
              );
              await setState(ctx, state);
            } catch {
              /* ignore */
            }
          } else if (options.onEditFail === 'ignore') {
            return;
          }
          const sentMessage = await ctx.reply(view?.text ?? '', {
            reply_markup: keyboardMarkup,
            link_preview_options: { is_disabled: view?.disablePreview ?? true },
          });
          const sentId = (sentMessage as Message).message_id;
          if (sentId) await remember(sentId);
          return;
        }
      }
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    const sentMessage = await ctx.reply(view?.text ?? '', {
      reply_markup: keyboardMarkup,
      link_preview_options: { is_disabled: view?.disablePreview ?? true },
    });
    const sentId = (sentMessage as Message).message_id;
    if (sentId) await remember(sentId);
  }

  async function _navigate<NP = unknown>(
    ctx: Context,
    route: Route<A, NP>,
    params?: NP
  ): Promise<void> {
    const state = await getState(ctx);
    state.stack.push(route.id);
    state.params[route.id] = params as unknown;

    const e = getEntry(route.id);
    if (!e) throw new Error(`Route not found: ${route.id}`);
    const inheritedShowBack = e.hasBackEffective && !!e.parentId;

    state.awaitingTextRouteId = undefined;
    await setState(ctx, state);
    const showCancel = route.onText
      ? typeof route.showCancelOnWait === 'boolean'
        ? route.showCancelOnWait
        : options.showCancelOnWait === true
      : false;
    try {
      function navigateImpl<NP = unknown>(
        r: Route<A, NP>,
        p?: NP
      ): Promise<void> {
        return _navigate(ctx, r, p);
      }
      const view = await route.action({
        ctx,
        actions: currentActions as A,
        params: params as NP,
        navigate: navigateImpl as NavigateFn<A>,
        navigateBack: () => _navigateBack(ctx),
        state,
      } as RouteActionArgs<A, NP>);
      if (view) {
        await renderView(
          ctx,
          view as RouteView<A>,
          inheritedShowBack,
          showCancel
        );
      } else if (route.onText) {
        await renderView(
          ctx,
          { text: options.inputPrompt, buttons: [] } as RouteView<A>,
          inheritedShowBack,
          showCancel
        );
      }
      if (route.onText) {
        state.awaitingTextRouteId = route.id;
        await setState(ctx, state);
      }
    } catch (err) {
      await handleError(ctx, err, inheritedShowBack, showCancel);
    }
  }

  async function _navigateBack(ctx: Context): Promise<void> {
    const state = await getState(ctx);
    state.stack.pop();
    state.awaitingTextRouteId = undefined;
    await setState(ctx, state);

    const currentId = getCurrentRouteId(state);
    if (!currentId) {
      try {
        await ctx.editMessageReplyMarkup(undefined);
      } catch {
        /* ignore */
      }
      return;
    }

    const e = getEntry(currentId);
    if (!e) return;
    const route = e.route;
    const params = state.params[currentId];
    const inheritedShowBack = e.hasBackEffective && !!e.parentId;
    const showCancel = route.onText
      ? typeof route.showCancelOnWait === 'boolean'
        ? route.showCancelOnWait
        : options.showCancelOnWait === true
      : false;
    try {
      function navigateImpl<NP = unknown>(
        r: Route<A, NP>,
        p?: NP
      ): Promise<void> {
        return _navigate(ctx, r, p);
      }
      const view = await route.action({
        ctx,
        actions: currentActions as A,
        params,
        navigate: navigateImpl as NavigateFn<A>,
        navigateBack: () => _navigateBack(ctx),
        state,
      } as RouteActionArgs<A, unknown>);
      if (view) {
        await renderView(
          ctx,
          view as RouteView<A>,
          inheritedShowBack,
          showCancel
        );
      } else if (route.onText) {
        await renderView(
          ctx,
          { text: options.inputPrompt, buttons: [] } as RouteView<A>,
          inheritedShowBack,
          showCancel
        );
      }
      if (route.onText) {
        state.awaitingTextRouteId = currentId;
        await setState(ctx, state);
      }
    } catch (err) {
      await handleError(ctx, err, inheritedShowBack, showCancel);
    }
  }

  async function _cancelWait(ctx: Context): Promise<void> {
    const state = await getState(ctx);
    if (state.awaitingTextRouteId) {
      const rid = state.awaitingTextRouteId;
      if (rid === getCurrentRouteId(state)) state.stack.pop();
      state.awaitingTextRouteId = undefined;
      await setState(ctx, state);
    }
    await _navigateBack(ctx);
  }

  async function handleError(
    ctx: Context,
    err: unknown,
    inheritedShowBack: boolean,
    inheritedShowCancel: boolean
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
      await renderView(
        ctx,
        v as RouteView<A>,
        inheritedShowBack,
        inheritedShowCancel
      );
      return;
    }
    const v: RouteView<unknown> = {
      text: `${options.errorPrefix}Неизвестная ошибка`,
      buttons: [],
      renderMode: options.errorRenderMode,
    };
    await renderView(
      ctx,
      v as RouteView<A>,
      inheritedShowBack,
      inheritedShowCancel
    );
  }

  let currentActions: A | null = null;

  return {
    run(bot: Telegraf<Context>, actions: A): RunningRouter<A> {
      currentActions = actions;

      bot.on('callback_query', async (ctx) => {
        const key = getKey(ctx);
        await mutex.runExclusive(key, async () => {
          const state = await getState(ctx);
          const data = (ctx as Context & { callbackQuery?: { data?: string } })
            .callbackQuery?.data as string | undefined;
          if (!data) return;

          const parsed = parseCb(data);
          (ctx as Context & { match?: string[] }).match = [
            data,
            ...parsed.args,
          ];

          try {
            await ctx.answerCbQuery();
          } catch {
            /* ignore */
          }

          if (data === options.cancelCallbackData) {
            await _cancelWait(ctx);
            return;
          }
          if (data === options.backCallbackData) {
            await _navigateBack(ctx);
            return;
          }

          const mid = (
            ctx as Context & {
              callbackQuery?: { message?: { message_id?: number } };
            }
          ).callbackQuery?.message?.message_id;
          let matched: Button<A> | undefined;
          if (mid) {
            const messageEntry = state.messages.find(
              (m) => m.messageId === mid
            );
            if (messageEntry) {
              outer1: for (const row of messageEntry.buttons as Button<A>[][]) {
                for (const button of row) {
                  if (button.callback === data) {
                    matched = button;
                    break outer1;
                  }
                }
              }
            }
          }
          if (!matched) {
            const last = state.messages[state.messages.length - 1];
            if (last) {
              outer2: for (const row of last.buttons as Button<A>[][]) {
                for (const button of row) {
                  if (button.callback === data) {
                    matched = button;
                    break outer2;
                  }
                }
              }
            }
          }

          if (matched?.action) {
            try {
              function navigateImpl<NP = unknown>(
                r: Route<A, NP>,
                p?: NP
              ): Promise<void> {
                return _navigate(ctx, r, p);
              }
              await matched.action({
                ctx,
                actions: currentActions as A,
                navigate: navigateImpl as NavigateFn<A>,
                navigateBack: () => _navigateBack(ctx),
              });
            } catch (err) {
              const curId = getCurrentRouteId(state);
              if (!curId) return;
              const e = getEntry(curId);
              const inheritedShowBack = !!e?.hasBackEffective && !!e?.parentId;
              await handleError(ctx, err, inheritedShowBack, false);
            }
            return;
          }

          const rid = parsed.routeId;
          const e = getEntry(rid);
          if (e) {
            const params = state.params[rid];
            await _navigate(ctx, e.route, params);
            return;
          }
        });
      });

      bot.on('text', async (ctx, next) => {
        const key = getKey(ctx);
        await mutex.runExclusive(key, async () => {
          const state = await getState(ctx);
          const rid = state.awaitingTextRouteId;
          if (!rid) {
            await next();
            return;
          }

          const txt = (
            ctx as Context & { message?: { text?: string } }
          ).message?.text?.trim();
          if (
            txt &&
            options.cancelCommands.some(
              (c) => c.toLowerCase() === txt.toLowerCase()
            )
          ) {
            await _cancelWait(ctx);
            return;
          }

          const e = getEntry(rid);
          if (!e) {
            await next();
            return;
          }
          const route = e.route;
          if (!route.onText) {
            await next();
            return;
          }
          const params = state.params[rid];
          try {
            function navigateImpl<NP = unknown>(
              r: Route<A, NP>,
              p?: NP
            ): Promise<void> {
              return _navigate(ctx, r, p);
            }
            const result = await route.onText({
              ctx,
              actions: currentActions as A,
              params,
              navigate: navigateImpl as NavigateFn<A>,
              navigateBack: () => _navigateBack(ctx),
              state: state,
              text: txt ?? '',
            });
            const newState = await getState(ctx);
            if (newState.awaitingTextRouteId !== rid) {
              return;
            }
            if (result) {
              const inheritedShowBack = e.hasBackEffective && !!e.parentId;
              await renderView(
                ctx,
                result as RouteView<A>,
                inheritedShowBack,
                false
              );
              newState.awaitingTextRouteId = undefined;
              await setState(ctx, newState);
            } else {
              await _navigateBack(ctx);
            }
          } catch (err) {
            const inheritedShowBack = e.hasBackEffective && !!e.parentId;
            await handleError(ctx, err, inheritedShowBack, true);
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
        navigate(
          ctx: Context,
          route: Route<A, unknown>,
          params?: unknown
        ): Promise<void> {
          return mutex.runExclusive(getKey(ctx), () =>
            _navigate(ctx, route, params)
          );
        },
        navigateBack(ctx: Context): Promise<void> {
          return mutex.runExclusive(getKey(ctx), () => _navigateBack(ctx));
        },
      };
    },
  };
}

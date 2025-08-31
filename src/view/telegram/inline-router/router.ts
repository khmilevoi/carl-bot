/**
 * Inline Router runtime: registers handlers and routes, manages state, and renders views.
 */
import type { Context, Telegraf } from 'telegraf';

import { DEFAULTS, type ResolvedOptions } from './defaults';
import { SimpleMutex } from './mutex';
import { createRenderer } from './render';
import { createRun, type Entry as RuntimeEntry } from './runtime';
import type {
  Route,
  RouteNode,
  RouterState,
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
  };

  const entries = new Map<string, RuntimeEntry<A>>();

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

  const { render } = createRenderer<A>(options, getState, setState);

  const run = createRun<A>({
    options,
    entries,
    mutex,
    getKey,
    getState,
    setState,
    render,
  });

  return { run };
}

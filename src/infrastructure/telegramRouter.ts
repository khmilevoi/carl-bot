/* eslint-disable import/no-unused-modules */
import assert from 'node:assert';

import type { Context, Telegraf } from 'telegraf';

export interface ButtonApi<RouteId extends string = string> {
  text: string;
  callback: string;
  target?: RouteId;
  action?: (ctx: Context) => Promise<void> | void;
}

interface RouteBuilderOptions<Data = unknown> {
  loadData: () => Promise<Data> | Data;
}

export interface RouteApi<RouteId extends string = string, Data = unknown> {
  id: RouteId;
  build: (
    opts: RouteBuilderOptions<Data>
  ) => Promise<{ text: string; buttons: ButtonApi<RouteId>[] }>;
}

export function createButton<RouteId extends string = string>(
  button: ButtonApi<RouteId>
): ButtonApi<RouteId> {
  return button;
}

export function createRoute<RouteId extends string = string, Data = unknown>(
  id: RouteId,
  build: (opts: RouteBuilderOptions<Data>) =>
    | Promise<{ text: string; buttons: ButtonApi<RouteId>[] }>
    | {
        text: string;
        buttons: ButtonApi<RouteId>[];
      }
): RouteApi<RouteId, Data> {
  return { id, build: async (o) => build(o) };
}

export function registerRoutes<RouteId extends string = string>(
  bot: Telegraf<Context>,
  routes: RouteApi<RouteId, unknown>[]
): {
  show(
    ctx: Context,
    id: RouteId,
    opts?: {
      loadData?: () => Promise<unknown> | unknown;
    }
  ): Promise<void>;
} {
  interface Node {
    id: RouteId;
    parent?: Node;
    children: Node[];
    loadData?: () => Promise<unknown> | unknown;
  }
  const trees = new Map<number, Node>();
  const current = new Map<number, Node>();
  const registered = new Set<string>();

  function registerButton(button: ButtonApi<RouteId>): void {
    if (registered.has(button.callback)) return;
    registered.add(button.callback);
    bot.action(button.callback, async (ctx) => {
      const chatId = ctx.chat?.id;
      assert(chatId, 'This is not a chat');
      await ctx.deleteMessage().catch(() => {});

      if (button.target) {
        await show(ctx, button.target);
      }
      if (button.action) {
        await button.action(ctx);
      }
      await ctx.answerCbQuery().catch(() => {});
    });
  }

  async function buildRoute(
    route: RouteApi<RouteId, unknown>,
    loader?: () => Promise<unknown> | unknown
  ): Promise<{ text: string; buttons: ButtonApi<RouteId>[] }> {
    const result = await route.build({
      loadData: async () => await loader?.(),
    });
    for (const button of result.buttons) {
      registerButton(button);
    }
    return result;
  }

  async function show(
    ctx: Context,
    id: RouteId,
    opts?: {
      loadData?: () => Promise<unknown> | unknown;
    }
  ): Promise<void> {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');
    const route = routes.find((w) => w.id === id);
    if (!route) return;
    const currentNode = current.get(chatId);
    let node: Node | undefined;
    let parentForNew: Node | undefined;

    if (!currentNode) {
      const root = trees.get(chatId);
      if (root && root.id === id) {
        node = root;
      } else {
        parentForNew = undefined;
      }
    } else if (currentNode.id === id) {
      node = currentNode;
    } else {
      let ancestor: Node | undefined = currentNode.parent;
      while (ancestor && ancestor.id !== id) {
        ancestor = ancestor.parent;
      }
      if (ancestor) {
        node = ancestor;
      } else {
        const child = currentNode.children.find((c) => c.id === id);
        if (child) {
          node = child;
        } else {
          parentForNew = currentNode;
        }
      }
    }

    const built = await buildRoute(
      route,
      opts?.loadData ?? node?.loadData
    ).catch(() => undefined);
    if (!built) return;
    const { text, buttons } = built;

    if (!node) {
      node = {
        id,
        parent: parentForNew,
        children: [],
        loadData: opts?.loadData,
      };
      if (parentForNew) {
        parentForNew.children.push(node);
      } else {
        trees.set(chatId, node);
      }
    } else if (opts?.loadData) {
      node.loadData = opts.loadData;
    }
    current.set(chatId, node);

    const keyboard = buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);
    if (node.parent) {
      keyboard.push([{ text: '⬅️ Назад', callback_data: 'back' }]);
    }

    await ctx.reply(text, { reply_markup: { inline_keyboard: keyboard } });
  }

  for (const route of routes) {
    buildRoute(route).catch(() => {
      /* ignore routes requiring data */
    });
  }

  bot.action('back', async (ctx) => {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');
    await ctx.deleteMessage().catch(() => {});

    const currentNode = current.get(chatId);
    const parent = currentNode?.parent;
    if (parent) {
      current.set(chatId, parent);
      await show(ctx, parent.id);
    } else {
      current.delete(chatId);
      trees.delete(chatId);
    }

    await ctx.answerCbQuery().catch(() => {});
  });

  return { show };
}

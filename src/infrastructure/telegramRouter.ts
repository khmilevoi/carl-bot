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
    let currentNode = current.get(chatId);

    if (!currentNode) {
      const root = trees.get(chatId);
      if (root && root.id === id) {
        currentNode = root;
        if (opts?.loadData) currentNode.loadData = opts.loadData;
      } else {
        currentNode = {
          id,
          children: [],
          loadData: opts?.loadData,
        };
        trees.set(chatId, currentNode);
      }
      current.set(chatId, currentNode);
    } else if (currentNode.id === id) {
      if (opts?.loadData) {
        currentNode.loadData = opts.loadData;
      }
    } else {
      let ancestor: Node | undefined = currentNode.parent;
      while (ancestor && ancestor.id !== id) {
        ancestor = ancestor.parent;
      }
      if (ancestor) {
        if (opts?.loadData) ancestor.loadData = opts.loadData;
        current.set(chatId, ancestor);
        currentNode = ancestor;
      } else {
        let next = currentNode.children.find((c) => c.id === id);
        if (!next) {
          next = {
            id,
            parent: currentNode,
            children: [],
            loadData: opts?.loadData,
          };
          currentNode.children.push(next);
        } else if (opts?.loadData) {
          next.loadData = opts.loadData;
        }
        current.set(chatId, next);
        currentNode = next;
      }
    }

    const { text, buttons } = await route.build({
      loadData: currentNode.loadData ?? (async () => undefined),
    });

    const keyboard = buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);
    if (currentNode.parent) {
      keyboard.push([{ text: '⬅️ Назад', callback_data: 'back' }]);
    }

    await ctx.reply(text, { reply_markup: { inline_keyboard: keyboard } });
  }

  for (const route of routes) {
    route
      .build({ loadData: async () => undefined })
      .then(({ buttons }) => {
        for (const button of buttons) {
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
      })
      .catch(() => {
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

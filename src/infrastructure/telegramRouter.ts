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
  interface HistoryItem {
    id: RouteId;
    loadData?: () => Promise<unknown> | unknown;
  }
  const history = new Map<number, HistoryItem[]>();

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

    let stack = history.get(chatId) ?? [];
    let index = stack.findIndex((h) => h.id === id);
    if (index >= 0) {
      if (opts?.loadData) {
        stack[index].loadData = opts.loadData;
      }
      stack = stack.slice(0, index + 1);
      history.set(chatId, stack);
    } else {
      stack.push({ id, loadData: opts?.loadData });
      history.set(chatId, stack);
      index = stack.length - 1;
    }

    const { text, buttons } = await route.build({
      loadData: stack[index].loadData ?? (async () => undefined),
    });

    const keyboard = buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);
    const newStack = history.get(chatId);
    if (newStack && newStack.length > 1) {
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

    const stack = history.get(chatId);
    if (stack && stack.length > 0) {
      stack.pop();
      const prev = stack[stack.length - 1];
      if (prev) {
        history.set(chatId, stack);
        await show(ctx, prev.id);
      } else {
        history.delete(chatId);
      }
    }

    await ctx.answerCbQuery().catch(() => {});
  });

  return { show };
}

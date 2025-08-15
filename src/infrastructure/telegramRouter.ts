/* eslint-disable import/no-unused-modules */
import assert from 'node:assert';

import type { Context, Telegraf } from 'telegraf';

export interface ButtonApi<RouteId extends string = string> {
  text: string;
  callback: string;
  target?: RouteId;
  action?: (ctx: Context) => Promise<void> | void;
  resetStack?: boolean;
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
      resetStack?: boolean;
      keepParent?: boolean;
    }
  ): Promise<void>;
} {
  const parents = new Map<number, RouteId>();
  const current = new Map<number, RouteId>();

  async function show(
    ctx: Context,
    id: RouteId,
    opts?: {
      loadData?: () => Promise<unknown> | unknown;
      resetStack?: boolean;
      keepParent?: boolean;
    }
  ): Promise<void> {
    const route = routes.find((w) => w.id === id);
    if (!route) return;

    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');

    const prev = current.get(chatId);
    let parent: RouteId | undefined;
    if (opts?.resetStack) {
      parent = undefined;
    } else if (opts?.keepParent) {
      parent = parents.get(chatId);
    } else {
      parent = prev;
    }
    if (parent) {
      parents.set(chatId, parent);
    } else {
      parents.delete(chatId);
    }
    current.set(chatId, id);

    const { text, buttons } = await route.build({
      loadData: opts?.loadData ?? (async () => undefined),
    });

    const keyboard = buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);
    if (parents.has(chatId)) {
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
              await show(ctx, button.target, {
                resetStack: button.resetStack,
              });
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

    const prev = parents.get(chatId);
    if (prev) {
      await show(ctx, prev, { resetStack: true });
    } else {
      current.delete(chatId);
    }

    await ctx.answerCbQuery().catch(() => {});
  });

  return { show };
}

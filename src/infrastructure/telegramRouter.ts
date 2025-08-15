/* eslint-disable import/no-unused-modules */
import assert from 'node:assert';

import type { Context, Telegraf } from 'telegraf';

export interface ButtonApi<RouteId extends string = string> {
  text: string;
  callback: string;
  target?: RouteId;
  action?: (ctx: Context) => Promise<void> | void;
}

export interface RouteApi<RouteId extends string = string, Actions = unknown> {
  id: RouteId;
  text: string;
  buttons:
    | ButtonApi<RouteId>[]
    | ((
        actions: Actions
      ) => Promise<ButtonApi<RouteId>[]> | ButtonApi<RouteId>[]);
}

export function createButton<RouteId extends string = string>(
  button: ButtonApi<RouteId>
): ButtonApi<RouteId> {
  return button;
}

export function createRoute<RouteId extends string = string, Actions = unknown>(
  route: RouteApi<RouteId, Actions>
): RouteApi<RouteId, Actions> {
  return route;
}

export function registerRoutes<
  RouteId extends string = string,
  Actions = unknown,
>(
  bot: Telegraf<Context>,
  routes: RouteApi<RouteId, Actions>[],
  actions: Actions
): { show(ctx: Context, id: RouteId, skipStack?: boolean): Promise<void> } {
  const stacks = new Map<number, RouteId[]>();
  const current = new Map<number, RouteId>();

  function getStack(chatId: number): RouteId[] {
    let stack = stacks.get(chatId);
    if (!stack) {
      stack = [];
      stacks.set(chatId, stack);
    }
    return stack;
  }

  async function show(
    ctx: Context,
    id: RouteId,
    skipStack = false
  ): Promise<void> {
    const route = routes.find((w) => w.id === id);
    if (!route) {
      return;
    }

    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');

    const currentId = current.get(chatId);
    if (!skipStack && currentId && currentId !== id) {
      getStack(chatId).push(currentId);
    }
    current.set(chatId, id);

    const buttons =
      typeof route.buttons === 'function'
        ? await route.buttons(actions)
        : route.buttons;
    const keyboard = buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);

    if (getStack(chatId).length > 0) {
      keyboard.push([{ text: '⬅️ Назад', callback_data: 'back' }]);
    }

    await ctx.reply(route.text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  for (const route of routes) {
    if (typeof route.buttons === 'function') {
      continue;
    }
    for (const button of route.buttons) {
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
  }

  bot.action('back', async (ctx) => {
    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');
    await ctx.deleteMessage().catch(() => {});

    const stack = getStack(chatId);
    const prev = stack.pop();
    if (prev) {
      await show(ctx, prev, true);
    } else {
      current.delete(chatId);
    }

    await ctx.answerCbQuery().catch(() => {});
  });

  return { show };
}

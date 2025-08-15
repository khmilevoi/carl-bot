import assert from 'node:assert';

import type { Context, Telegraf } from 'telegraf';

import type { RouteDescriptor, RouterApi } from './router/factories';

export class WindowRouter<T extends Record<string, unknown>> {
  private stacks = new Map<number, string[]>();
  private currentWindow = new Map<number, string>();
  private registered = new Set<string>();

  constructor(
    private readonly bot: Telegraf<Context>,
    private readonly routes: RouteDescriptor<T>[],
    private readonly actions: T
  ) {
    this.registerBack();
  }

  async show(ctx: Context, id: string, skipStack = false): Promise<void> {
    const route = this.routes.find((r) => r.id === id);
    if (!route) {
      return;
    }

    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');

    const current = this.currentWindow.get(chatId);
    if (!skipStack && current && current !== id) {
      this.getStack(chatId).push(current);
    }
    this.currentWindow.set(chatId, id);

    const api = this.getApi();
    const { buttons } = await route.build(api, ctx);

    for (const button of buttons) {
      if (this.registered.has(button.callback)) {
        continue;
      }
      this.registered.add(button.callback);
      this.bot.action(button.callback, async (btnCtx) => {
        const btnChatId = btnCtx.chat?.id;
        assert(btnChatId, 'This is not a chat');
        await btnCtx.deleteMessage().catch(() => {});
        await button.handler(api, btnCtx);
        await btnCtx.answerCbQuery().catch(() => {});
      });
    }

    const keyboard = buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);

    if (this.getStack(chatId).length > 0) {
      keyboard.push([{ text: '⬅️ Назад', callback_data: 'back' }]);
    }

    await ctx.reply(route.text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private registerBack(): void {
    this.bot.action('back', async (ctx) => {
      const chatId = ctx.chat?.id;
      assert(chatId, 'This is not a chat');
      await ctx.deleteMessage().catch(() => {});

      const stack = this.getStack(chatId);
      const prev = stack.pop();
      if (prev) {
        await this.show(ctx, prev, true);
      } else {
        this.currentWindow.delete(chatId);
      }

      await ctx.answerCbQuery().catch(() => {});
    });
  }

  private getApi(): RouterApi<T> {
    return {
      show: (ctx: Context, id: string) => this.show(ctx, id),
      ...this.actions,
    } as RouterApi<T>;
  }

  private getStack(chatId: number): string[] {
    let stack = this.stacks.get(chatId);
    if (!stack) {
      stack = [];
      this.stacks.set(chatId, stack);
    }
    return stack;
  }
}

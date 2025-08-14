import assert from 'node:assert';

import { Context, Telegraf } from 'telegraf';

import type { WindowDefinition } from './windowConfig';

interface ActionHandlers {
  [key: string]: (ctx: Context) => Promise<void> | void;
}

type StackItem = string;

export class WindowRouter {
  private stacks = new Map<number, StackItem[]>();
  private currentWindow = new Map<number, string>();

  constructor(
    private readonly bot: Telegraf<Context>,
    private readonly windows: WindowDefinition[],
    private readonly actions: ActionHandlers
  ) {
    this.register();
  }

  async show(ctx: Context, id: string, skipStack = false): Promise<void> {
    const window = this.windows.find((w) => w.id === id);
    if (window === undefined) {
      return;
    }

    const chatId = ctx.chat?.id;
    assert(chatId !== undefined, 'This is not a chat');

    const current = this.currentWindow.get(chatId);
    if (!skipStack && current !== undefined && current !== id) {
      this.getStack(chatId).push(current);
    }
    this.currentWindow.set(chatId, id);

    const keyboard = window.buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);

    if (this.getStack(chatId).length > 0) {
      keyboard.push([{ text: '⬅️ Назад', callback_data: 'back' }]);
    }

    await ctx.reply(window.text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private register() {
    for (const window of this.windows) {
      for (const button of window.buttons) {
        this.bot.action(button.callback, async (ctx) => {
          const chatId = ctx.chat?.id;
          assert(chatId !== undefined, 'This is not a chat');
          await ctx.deleteMessage().catch(() => {});

          if (button.target !== undefined) {
            await this.show(ctx, button.target);
          }

          if (button.action !== undefined) {
            const action = this.actions[button.action];
            if (typeof action === 'function') {
              await action(ctx);
            }
          }

          await ctx.answerCbQuery().catch(() => {});
        });
      }
    }

    this.bot.action('back', async (ctx) => {
      const chatId = ctx.chat?.id;
      assert(chatId !== undefined, 'This is not a chat');
      await ctx.deleteMessage().catch(() => {});

      const stack = this.getStack(chatId);
      const prev = stack.pop();
      if (prev !== undefined) {
        await this.show(ctx, prev, true);
      } else {
        this.currentWindow.delete(chatId);
      }

      await ctx.answerCbQuery().catch(() => {});
    });
  }

  private getStack(chatId: number): StackItem[] {
    let stack = this.stacks.get(chatId);
    if (stack === undefined) {
      stack = [];
      this.stacks.set(chatId, stack);
    }
    return stack;
  }
}

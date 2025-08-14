import assert from 'node:assert';

import { Context, Telegraf } from 'telegraf';

import type { WindowDefinition } from './windowConfig';

interface ActionHandlers {
  [key: string]: (ctx: Context) => Promise<void> | void;
}

type StackItem = [string, number];

export class WindowRouter {
  private stacks = new Map<number, StackItem[]>();

  constructor(
    private readonly bot: Telegraf<Context>,
    private readonly windows: WindowDefinition[],
    private readonly actions: ActionHandlers
  ) {
    this.register();
  }

  private register() {
    for (const window of this.windows) {
      for (const button of window.buttons) {
        this.bot.action(button.callback, async (ctx) => {
          const chatId = ctx.chat?.id;
          const messageId = ctx.callbackQuery?.message?.message_id;
          assert(chatId, 'This is not a chat');
          await ctx.deleteMessage().catch(() => {});

          if (button.target && messageId) {
            this.getStack(chatId).push([window.id, messageId]);
            await this.show(ctx, button.target);
          }

          if (button.action) {
            const action = this.actions[button.action];
            if (action) {
              await action(ctx);
            }
          }

          await ctx.answerCbQuery().catch(() => {});
        });
      }
    }

    this.bot.action('back', async (ctx) => {
      const chatId = ctx.chat?.id;
      assert(chatId, 'This is not a chat');
      await ctx.deleteMessage().catch(() => {});

      const stack = this.getStack(chatId);
      const prev = stack.pop();
      if (prev) {
        await this.show(ctx, prev[0]);
      }

      await ctx.answerCbQuery().catch(() => {});
    });
  }

  private getStack(chatId: number): StackItem[] {
    let stack = this.stacks.get(chatId);
    if (!stack) {
      stack = [];
      this.stacks.set(chatId, stack);
    }
    return stack;
  }

  async show(ctx: Context, id: string): Promise<void> {
    const window = this.windows.find((w) => w.id === id);
    if (!window) {
      return;
    }

    const chatId = ctx.chat?.id;
    assert(chatId, 'This is not a chat');

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
}

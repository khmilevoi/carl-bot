import type { Context, Telegraf } from 'telegraf';

import type { WindowDefinition } from './windowConfig';

type ActionHandlers = Record<string, (ctx: Context) => Promise<void> | void>;

export class WindowRouter {
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
          const action = button.action
            ? this.actions[button.action]
            : undefined;
          if (action) {
            await action(ctx);
          }
          if (button.target) {
            await this.showWindow(ctx, button.target);
          }
          await ctx.answerCbQuery().catch(() => {});
        });
      }
    }
  }

  async showWindow(ctx: Context, id: string): Promise<void> {
    const window = this.windows.find((w) => w.id === id);
    if (!window) {
      return;
    }

    const keyboard = window.buttons.map((b) => [
      { text: b.text, callback_data: b.callback },
    ]);

    await ctx.reply(window.text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }
}

import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import {
  createRouter,
  route,
} from '../../../src/view/telegram/telegraf-inline-router';

describe('telegraf-inline-router', () => {
  it('shows cancel on wait and hides it after text', async () => {
    const r = route({
      id: 'input',
      showCancelOnWait: true,
      async action() {
        return { text: 'prompt', buttons: [] };
      },
      async onText() {
        return { text: 'done', buttons: [] };
      },
    });
    const { run } = createRouter([r], { showCancelOnWait: false });
    const bot = new Telegraf<Context>('token');
    const onSpy = vi.spyOn(bot, 'on');
    const router = run(bot, {});
    const textHandler = onSpy.mock.calls.find(([e]) => e === 'text')?.[1] as
      | ((ctx: Context, next: () => Promise<void>) => Promise<void>)
      | undefined;
    onSpy.mockRestore();
    if (!textHandler) throw new Error('text handler not registered');
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi.fn(async () => ({ message_id: 1 })),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
    } as unknown as Context;

    await router.navigate(ctx, r);
    const firstKeyboard = (
      ctx.reply.mock.calls[0][1] as {
        reply_markup: { inline_keyboard: unknown[] };
      }
    ).reply_markup.inline_keyboard;
    expect(firstKeyboard).toEqual([
      [
        expect.objectContaining({
          text: '✖️ Отмена',
          callback_data: '__router_cancel__',
        }),
      ],
    ]);

    const ctxText = {
      ...ctx,
      message: { text: 'hello', date: 0 },
    } as Context & { message: { text: string; date: number } };
    await textHandler(ctxText, async () => {});
    const lastCall = ctx.reply.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('done');
    const lastKeyboard = (
      lastCall?.[1] as {
        reply_markup: { inline_keyboard: unknown[] };
      }
    ).reply_markup.inline_keyboard;
    expect(lastKeyboard).toEqual([]);
  });

  it('allows overriding showBack and showCancel in view', async () => {
    const r = route({
      id: 'root',
      async action() {
        return { text: 'hello', buttons: [], showBack: true, showCancel: true };
      },
    });
    const { run } = createRouter([r], { showCancelOnWait: false });
    const bot = new Telegraf<Context>('token');
    const router = run(bot, {});
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi.fn(async () => ({ message_id: 1 })),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
    } as unknown as Context;

    await router.navigate(ctx, r);
    const kb = (
      ctx.reply.mock.calls[0][1] as {
        reply_markup: { inline_keyboard: unknown[] };
      }
    ).reply_markup.inline_keyboard;
    expect(kb).toEqual([
      [
        expect.objectContaining({
          text: '✖️ Отмена',
          callback_data: '__router_cancel__',
        }),
        expect.objectContaining({
          text: '⬅️ Назад',
          callback_data: '__router_back__',
        }),
      ],
    ]);
  });
});

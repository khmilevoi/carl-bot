import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { createRouter, route } from '@/view/telegram/inline-router';

describe('inline-router', () => {
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

  it.each([true, false])(
    'cancels on /cancel (showCancelOnWait: %s)',
    async (showCancelOnWait) => {
      const state: Record<string, unknown> = {};
      const stateStore = {
        async get(_chatId: number, _userId: number) {
          return state.value as unknown;
        },
        async set(_chatId: number, _userId: number, s: unknown) {
          state.value = s;
        },
        async delete(_chatId: number, _userId: number) {
          state.value = undefined;
        },
      };
      const r = route({
        id: 'input',
        async action() {
          return { text: 'prompt', buttons: [] };
        },
        async onText() {
          return { text: 'done', buttons: [] };
        },
      });
      const { run } = createRouter([r], { showCancelOnWait, stateStore });
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
      const kb = (
        ctx.reply.mock.calls[0][1] as {
          reply_markup: { inline_keyboard: unknown[] };
        }
      ).reply_markup.inline_keyboard;
      if (showCancelOnWait) {
        expect(kb).toEqual([
          [
            expect.objectContaining({
              text: '✖️ Отмена',
              callback_data: '__router_cancel__',
            }),
          ],
        ]);
      } else {
        expect(kb).toEqual([]);
      }

      const ctxText = {
        ...ctx,
        message: { text: '/cancel', date: 0 },
      } as Context & { message: { text: string; date: number } };
      await textHandler(ctxText, async () => {});
      const st = (await stateStore.get(1, 1)) as
        | { stack: unknown[] }
        | undefined;
      expect(st?.stack.length).toBe(0);
    }
  );

  it('cancels on cancel button', async () => {
    const state: Record<string, unknown> = {};
    const stateStore = {
      async get(_chatId: number, _userId: number) {
        return state.value as unknown;
      },
      async set(_chatId: number, _userId: number, s: unknown) {
        state.value = s;
      },
      async delete(_chatId: number, _userId: number) {
        state.value = undefined;
      },
    };
    const r = route({
      id: 'input',
      async action() {
        return { text: 'prompt', buttons: [] };
      },
      async onText() {
        return { text: 'done', buttons: [] };
      },
    });
    const { run } = createRouter([r], { showCancelOnWait: true, stateStore });
    const bot = new Telegraf<Context>('token');
    const onSpy = vi.spyOn(bot, 'on');
    const router = run(bot, {});
    const cbHandler = onSpy.mock.calls.find(
      ([e]) => e === 'callback_query'
    )?.[1] as ((ctx: Context) => Promise<void>) | undefined;
    onSpy.mockRestore();
    if (!cbHandler) throw new Error('callback handler not registered');
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi.fn(async () => ({ message_id: 1 })),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await router.navigate(ctx, r);
    const ctxCb = {
      ...ctx,
      callbackQuery: { data: '__router_cancel__', message: { message_id: 1 } },
    } as Context & {
      callbackQuery: { data: string; message: { message_id: number } };
    };
    await cbHandler(ctxCb);
    const st = (await stateStore.get(1, 1)) as { stack: unknown[] } | undefined;
    expect(st?.stack.length).toBe(0);
  });
});

import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import {
  createRouter,
  route,
  button,
  cb,
  type RouterState,
  type StateStore,
  RouterUserError,
} from '@/view/telegram/inline-router';

describe('inline-router', () => {
  it('renders inputPrompt when action returns nothing', async () => {
    const r = route({
      id: 'input',
      async action() {},
      async onText() {},
    });
    const { run } = createRouter([r], {
      inputPrompt: 'enter text',
      showCancelOnWait: false,
    });
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
    expect(ctx.reply.mock.calls[0][0]).toBe('enter text');
  });

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
    const handlers = onSpy.mock.calls
      .filter(([e]) => e === 'text')
      .map(
        ([, h]) =>
          h as (ctx: Context, next?: () => Promise<void>) => Promise<void>
      );
    onSpy.mockRestore();
    const [textHandler, fallbackHandler] = handlers;
    if (!textHandler || !fallbackHandler)
      throw new Error('text handler not registered');
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
    await textHandler(ctxText, () => fallbackHandler(ctxText));
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

  it('calls button action and answers callback query', async () => {
    const action = vi.fn(async () => {});
    const r = route({
      id: 'root',
      async action() {
        return {
          text: 'hello',
          buttons: [
            button({
              text: 'do',
              callback: cb('do'),
              action,
              answer: { text: 'done', showAlert: true },
            }),
          ],
        };
      },
    });
    const { run } = createRouter([r]);
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
      callbackQuery: { data: cb('do'), message: { message_id: 1 } },
    } as Context & {
      callbackQuery: { data: string; message: { message_id: number } };
    };
    await cbHandler(ctxCb);
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ ctx: ctxCb })
    );
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'done',
      expect.objectContaining({ show_alert: true })
    );
  });

  it('drops oldest messages when maxMessages limit is exceeded', async () => {
    const firstRoute = route({
      id: 'first',
      async action() {
        return { text: 'first', buttons: [], renderMode: 'append' };
      },
    });
    const secondRoute = route({
      id: 'second',
      async action() {
        return { text: 'second', buttons: [], renderMode: 'append' };
      },
    });

    const stateStore: StateStore & { map: Map<string, RouterState> } = {
      map: new Map<string, RouterState>(),
      async get(chatId, userId) {
        return this.map.get(`${chatId}:${userId}`);
      },
      async set(chatId, userId, state) {
        this.map.set(`${chatId}:${userId}`, state);
      },
      async delete(chatId, userId) {
        this.map.delete(`${chatId}:${userId}`);
      },
    } as unknown as StateStore & { map: Map<string, RouterState> };

    const { run } = createRouter([firstRoute, secondRoute], {
      maxMessages: 1,
      stateStore,
    });
    const bot = new Telegraf<Context>('token');
    const router = run(bot, {});
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi
        .fn()
        .mockResolvedValueOnce({ message_id: 1 })
        .mockResolvedValueOnce({ message_id: 2 }),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
    } as unknown as Context;

    await router.navigate(ctx, firstRoute);
    await router.navigate(ctx, secondRoute);

    expect(ctx.deleteMessage).toHaveBeenCalledWith(1);
    const state = await stateStore.get(1, 1);
    expect(state?.messages).toEqual([
      expect.objectContaining({ messageId: 2 }),
    ]);
  });

  it('renders view from RouterUserError thrown in onText', async () => {
    const r = route({
      id: 'input',
      async action() {
        return { text: 'prompt', buttons: [] };
      },
      async onText() {
        throw new RouterUserError('bad', { text: 'error', buttons: [] });
      },
    });
    const { run } = createRouter([r], { showCancelOnWait: false });
    const bot = new Telegraf<Context>('token');
    const onSpy = vi.spyOn(bot, 'on');
    const router = run(bot, {});
    const handlers = onSpy.mock.calls
      .filter(([e]) => e === 'text')
      .map(
        ([, h]) =>
          h as (ctx: Context, next?: () => Promise<void>) => Promise<void>
      );
    onSpy.mockRestore();
    const [textHandler, fallbackHandler] = handlers;
    if (!textHandler || !fallbackHandler)
      throw new Error('text handler not registered');
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi.fn(async () => ({ message_id: 1 })),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
    } as unknown as Context;

    await router.navigate(ctx, r);
    const ctxText = {
      ...ctx,
      message: { text: 'hello', date: 0 },
    } as Context & { message: { text: string; date: number } };
    await textHandler(ctxText, () => fallbackHandler(ctxText));
    const lastCall = ctx.reply.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('error');
  });

  it('renders errorPrefix on unknown error and calls onError', async () => {
    const onError = vi.fn();
    const r = route({
      id: 'input',
      async action() {
        return { text: 'prompt', buttons: [] };
      },
      async onText() {
        throw new Error('fail');
      },
    });
    const { run } = createRouter([r], {
      showCancelOnWait: false,
      errorPrefix: 'Oops: ',
      onError,
    });
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
    const ctxText = {
      ...ctx,
      message: { text: 'hello', date: 0 },
    } as Context & { message: { text: string; date: number } };
    await textHandler(ctxText, async () => {});
    const lastCall = ctx.reply.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('Oops: Неизвестная ошибка');
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('runs navigate sequentially for the same ctx', async () => {
    const firstRoute = route({
      id: 'first',
      async action() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { text: 'first', buttons: [] };
      },
    });
    const secondRoute = route({
      id: 'second',
      async action() {
        return { text: 'second', buttons: [] };
      },
    });

    const { run } = createRouter([firstRoute, secondRoute], {});
    const bot = new Telegraf<Context>('token');
    const router = run(bot, {});
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi
        .fn()
        .mockResolvedValueOnce({ message_id: 1 })
        .mockResolvedValueOnce({ message_id: 2 }),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
    } as unknown as Context;

    const order: string[] = [];
    const p1 = router.navigate(ctx, firstRoute).then(() => {
      order.push('first');
    });
    const p2 = router.navigate(ctx, secondRoute).then(() => {
      order.push('second');
    });
    await Promise.all([p1, p2]);

    expect(order).toEqual(['first', 'second']);
  });

  it('calls text fallback when no route awaiting text', async () => {
    const r = route({
      id: 'root',
      async action() {
        return { text: 'hello', buttons: [] };
      },
    });
    const { run } = createRouter([r], { showCancelOnWait: false });
    const bot = new Telegraf<Context>('token');
    const onSpy = vi.spyOn(bot, 'on');
    const router = run(bot, {});
    const handlers = onSpy.mock.calls
      .filter(([e]) => e === 'text')
      .map(
        ([, h]) =>
          h as (ctx: Context, next?: () => Promise<void>) => Promise<void>
      );
    onSpy.mockRestore();
    const [textHandler, fallbackHandler] = handlers;
    if (!textHandler || !fallbackHandler)
      throw new Error('text handler not registered');
    const fallback = vi.fn();
    router.onText(fallback);
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi.fn(async () => ({ message_id: 1 })),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
    } as unknown as Context;
    await router.navigate(ctx, r);
    const ctxText = {
      ...ctx,
      message: { text: 'hi', date: 0 },
    } as Context & { message: { text: string; date: number } };
    await textHandler(ctxText, () => fallbackHandler(ctxText));
    expect(fallback).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledWith(ctxText);
  });

  it('does not call text fallback when awaiting text', async () => {
    const onText = vi.fn();
    const r = route({
      id: 'input',
      async action() {
        return { text: 'enter', buttons: [] };
      },
      async onText(args) {
        onText(args);
      },
    });
    const { run } = createRouter([r], { showCancelOnWait: false });
    const bot = new Telegraf<Context>('token');
    const onSpy = vi.spyOn(bot, 'on');
    const router = run(bot, {});
    const handlers = onSpy.mock.calls
      .filter(([e]) => e === 'text')
      .map(
        ([, h]) =>
          h as (ctx: Context, next?: () => Promise<void>) => Promise<void>
      );
    onSpy.mockRestore();
    const [textHandler, fallbackHandler] = handlers;
    if (!textHandler || !fallbackHandler)
      throw new Error('text handler not registered');
    const fallback = vi.fn();
    router.onText(fallback);
    const ctx = {
      chat: { id: 1 },
      from: { id: 1 },
      reply: vi.fn(async () => ({ message_id: 1 })),
      deleteMessage: vi.fn(async () => {}),
      editMessageText: vi.fn(async () => {}),
      editMessageReplyMarkup: vi.fn(async () => {}),
    } as unknown as Context;
    await router.navigate(ctx, r);
    const ctxText = {
      ...ctx,
      message: { text: 'hello', date: 0 },
    } as Context & { message: { text: string; date: number } };
    await textHandler(ctxText, () => fallbackHandler(ctxText));
    expect(onText).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });

  it('skips editMessageText when content is unchanged in smart mode', async () => {
    const state: Record<string, unknown> = {};
    const stateStore = {
      async get(_chatId: number, _userId: number) {
        return state.value as unknown;
      },
      async set(_chatId: number, _userId: number, value: unknown) {
        state.value = value;
      },
      async delete(_chatId: number, _userId: number) {
        state.value = undefined;
      },
    };
    const r = route({
      id: 'root',
      async action() {
        return { text: 'hello', buttons: [] };
      },
    });
    const { run } = createRouter([r], { stateStore });
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
    const ctxCb = {
      ...ctx,
      callbackQuery: { message: { message_id: 1 }, data: 'cb' },
    } as Context & {
      callbackQuery: { message: { message_id: number }; data: string };
    };
    await router.navigate(ctxCb, r);
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });

  it.each([
    ['edit', { editMessageText: 1, deleteMessage: 0, reply: 1 }],
    ['replace', { editMessageText: 0, deleteMessage: 1, reply: 2 }],
    ['append', { editMessageText: 0, deleteMessage: 0, reply: 1 }],
  ])(
    'uses correct Telegram methods for %s mode',
    async (renderMode, expectedCalls) => {
      const state: Record<string, unknown> = {};
      const stateStore = {
        async get(_chatId: number, _userId: number) {
          return state.value as unknown;
        },
        async set(_chatId: number, _userId: number, value: unknown) {
          state.value = value;
        },
        async delete(_chatId: number, _userId: number) {
          state.value = undefined;
        },
      };
      const r = route({
        id: 'root',
        async action() {
          return { text: 'hello', buttons: [] };
        },
      });
      const { run } = createRouter([r], { stateStore, renderMode });
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
      if (renderMode !== 'append') {
        const ctxCb = {
          ...ctx,
          callbackQuery: { message: { message_id: 1 }, data: 'cb' },
        } as Context & {
          callbackQuery: { message: { message_id: number }; data: string };
        };
        await router.navigate(ctxCb, r);
      }
      expect(ctx.editMessageText.mock.calls.length).toBe(
        expectedCalls.editMessageText
      );
      expect(ctx.deleteMessage.mock.calls.length).toBe(
        expectedCalls.deleteMessage
      );
      expect(ctx.reply.mock.calls.length).toBe(expectedCalls.reply);
    }
  );

  it.each([
    ['reply', { reply: 2, deleteMessage: 0 }],
    ['replace', { reply: 2, deleteMessage: 1 }],
    ['ignore', { reply: 1, deleteMessage: 0 }],
  ])(
    'handles editMessageText errors with onEditFail=%s',
    async (onEditFail, expectedCalls) => {
      const state: Record<string, unknown> = {};
      const stateStore = {
        async get(_chatId: number, _userId: number) {
          return state.value as unknown;
        },
        async set(_chatId: number, _userId: number, value: unknown) {
          state.value = value;
        },
        async delete(_chatId: number, _userId: number) {
          state.value = undefined;
        },
      };
      let updated = false;
      const r = route({
        id: 'root',
        async action() {
          if (updated) return { text: 'new', buttons: [] };
          updated = true;
          return { text: 'old', buttons: [] };
        },
      });
      const { run } = createRouter([r], { stateStore, onEditFail });
      const bot = new Telegraf<Context>('token');
      const router = run(bot, {});
      const ctx = {
        chat: { id: 1 },
        from: { id: 1 },
        reply: vi.fn(async () => ({ message_id: 1 })),
        deleteMessage: vi.fn(async () => {}),
        editMessageText: vi
          .fn(async () => ({ message_id: 1 }))
          .mockRejectedValueOnce(new Error('fail')),
        editMessageReplyMarkup: vi.fn(async () => {}),
      } as unknown as Context;

      await router.navigate(ctx, r);
      const ctxCb = {
        ...ctx,
        callbackQuery: { message: { message_id: 1 }, data: 'cb' },
      } as Context & {
        callbackQuery: { message: { message_id: number }; data: string };
      };
      await router.navigate(ctxCb, r);
      expect(ctx.reply.mock.calls.length).toBe(expectedCalls.reply);
      expect(ctx.deleteMessage.mock.calls.length).toBe(
        expectedCalls.deleteMessage
      );
    }
  );
});

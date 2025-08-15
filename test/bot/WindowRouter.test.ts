import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import {
  createButton,
  createRoute,
  registerRoutes,
} from '../../src/infrastructure/telegramRouter';

type RouteId = 'first' | 'second' | 'third' | 'needs_data';

const b = createButton<RouteId>;
const r = createRoute<RouteId>;

const windows = [
  r('first', async () => ({
    text: 'First window',
    buttons: [b({ text: 'Next', callback: 'to_second', target: 'second' })],
  })),
  r('second', async () => ({ text: 'Second window', buttons: [] })),
];

async function setupRouter(): Promise<{
  router: ReturnType<typeof registerRoutes<RouteId>>;
  goHandler: (ctx: Context) => Promise<void> | void;
  backHandler: (ctx: Context) => Promise<void> | void;
}> {
  const bot = new Telegraf<Context>('token');
  const actionSpy = vi.spyOn(bot, 'action');
  const router = registerRoutes<RouteId>(bot, windows);
  await new Promise((resolve) => setImmediate(resolve));
  const goCall = actionSpy.mock.calls.find(
    ([pattern]) => pattern === 'to_second'
  );
  const backCall = actionSpy.mock.calls.find(([pattern]) => pattern === 'back');
  actionSpy.mockRestore();
  if (!goCall || !backCall) {
    throw new Error('Handlers not registered');
  }
  const goHandler = goCall[1];
  const backHandler = backCall[1];
  return { router, goHandler, backHandler };
}

describe('telegramRouter', () => {
  it('transitions between windows and back', async () => {
    const { router, goHandler, backHandler } = await setupRouter();
    await router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'first'
    );

    const ctx = {
      chat: { id: 1 },
      callbackQuery: { message: { message_id: 10 } },
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await goHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith('Second window', {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back' }]],
      },
    });

    const ctxBack = {
      chat: { id: 1 },
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await backHandler(ctxBack);
    expect(ctxBack.reply).toHaveBeenCalledWith('First window', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Next', callback_data: 'to_second' }]],
      },
    });
  });

  it('adds back button when history exists', async () => {
    const { router, goHandler } = await setupRouter();
    await router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'first'
    );

    const ctx = {
      chat: { id: 1 },
      callbackQuery: { message: { message_id: 11 } },
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await goHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Second window', {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back' }]],
      },
    });
  });

  it('deletes messages on navigation and back', async () => {
    const { router, goHandler, backHandler } = await setupRouter();
    await router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'first'
    );

    const ctx = {
      chat: { id: 1 },
      callbackQuery: { message: { message_id: 12 } },
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await goHandler(ctx);
    expect(ctx.deleteMessage).toHaveBeenCalled();

    const ctxBack = {
      chat: { id: 1 },
      deleteMessage: vi.fn(async () => {}),
      reply: vi.fn(),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await backHandler(ctxBack);
    expect(ctxBack.deleteMessage).toHaveBeenCalled();
  });

  it('adds back button when show is called directly', async () => {
    const { router } = await setupRouter();
    const ctx = {
      chat: { id: 1 },
      reply: vi.fn(),
    } as unknown as Context;

    await router.show(ctx, 'first');
    await router.show(ctx, 'second');

    expect(ctx.reply).toHaveBeenNthCalledWith(2, 'Second window', {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back' }]],
      },
    });
  });

  it('resets history when resetStack is true', async () => {
    const { router } = await setupRouter();
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;

    await router.show(ctx, 'first');
    await router.show(ctx, 'second');
    await router.show(ctx, 'first', { resetStack: true });

    expect(ctx.reply).toHaveBeenNthCalledWith(3, 'First window', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Next', callback_data: 'to_second' }]],
      },
    });
  });

  it('does nothing when route id is not found', async () => {
    const { router } = await setupRouter();
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;

    await router.show(ctx, 'third');

    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('throws when context has no chat', async () => {
    const { router } = await setupRouter();
    await expect(
      router.show({ reply: vi.fn() } as unknown as Context, 'first')
    ).rejects.toThrow('This is not a chat');
  });

  it('skips routes that require data during registration', async () => {
    const bot = new Telegraf<Context>('token');
    const needsDataRoute = r('needs_data', async ({ loadData }) => {
      const items = (await loadData()) as string[];
      return {
        text: 'needs data',
        buttons: items.map((text) => b({ text, callback: text })),
      };
    });

    expect(() => registerRoutes<RouteId>(bot, [needsDataRoute])).not.toThrow();
  });
});

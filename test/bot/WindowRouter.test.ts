import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import {
  createButton,
  createRoute,
  registerRoutes,
  type RouteApi,
} from '../../src/infrastructure/telegram/telegramRouter';

type RouteId = 'first' | 'second' | 'third' | 'fourth' | 'needs_data';

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

async function setupCustomRouter(
  custom: RouteApi<RouteId, unknown>[]
): Promise<{
  router: ReturnType<typeof registerRoutes<RouteId>>;
  handlers: Record<string, (ctx: Context) => Promise<void> | void>;
}> {
  const bot = new Telegraf<Context>('token');
  const actionSpy = vi.spyOn(bot, 'action');
  const router = registerRoutes<RouteId>(bot, custom);
  await new Promise((resolve) => setImmediate(resolve));
  const handlers: Record<string, (ctx: Context) => Promise<void> | void> = {};
  for (const [pattern, handler] of actionSpy.mock.calls) {
    handlers[pattern as string] = handler;
  }
  actionSpy.mockRestore();
  return { router, handlers };
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

  it('resets history when navigating to an existing route', async () => {
    const { router } = await setupRouter();
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;

    await router.show(ctx, 'first');
    await router.show(ctx, 'second');
    await router.show(ctx, 'first');

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

  it('reuses existing nodes and updates load data', async () => {
    const { router } = await setupRouter();
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;

    await router.show(ctx, 'first');
    await router.show(ctx, 'second');
    await router.show(ctx, 'first');
    await router.show(ctx, 'second');
    await router.show(ctx, 'first', { loadData: async () => undefined });
    await router.show(ctx, 'second', { loadData: async () => undefined });
    await router.show(ctx, 'second');
    await router.show(ctx, 'second', { loadData: async () => undefined });

    expect(ctx.reply).toHaveBeenCalledTimes(8);
  });

  it('navigates across branches and back to different levels', async () => {
    const branchWindows: RouteApi<RouteId, unknown>[] = [
      r('first', async () => ({
        text: 'First window',
        buttons: [
          b({ text: 'To second', callback: 'to_second', target: 'second' }),
          b({ text: 'To third', callback: 'to_third', target: 'third' }),
        ],
      })),
      r('second', async () => ({
        text: 'Second window',
        buttons: [
          b({ text: 'To fourth', callback: 'to_fourth', target: 'fourth' }),
        ],
      })),
      r('third', async () => ({ text: 'Third window', buttons: [] })),
      r('fourth', async () => ({ text: 'Fourth window', buttons: [] })),
    ];
    const { router, handlers } = await setupCustomRouter(branchWindows);
    const backHandler = handlers['back'];
    const ctx = {
      chat: { id: 1 },
      reply: vi.fn(),
      deleteMessage: vi.fn(async () => {}),
      answerCbQuery: vi.fn(async () => {}),
    } as unknown as Context;

    await router.show(ctx, 'first');
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'First window', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'To second', callback_data: 'to_second' }],
          [{ text: 'To third', callback_data: 'to_third' }],
        ],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('first');

    await router.show(ctx, 'second');
    expect(ctx.reply).toHaveBeenNthCalledWith(2, 'Second window', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'To fourth', callback_data: 'to_fourth' }],
          [{ text: '⬅️ Назад', callback_data: 'back' }],
        ],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('second');

    await router.show(ctx, 'fourth');
    expect(ctx.reply).toHaveBeenNthCalledWith(3, 'Fourth window', {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back' }]],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('fourth');

    await backHandler(ctx);
    expect(ctx.reply).toHaveBeenNthCalledWith(4, 'Second window', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'To fourth', callback_data: 'to_fourth' }],
          [{ text: '⬅️ Назад', callback_data: 'back' }],
        ],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('second');

    await backHandler(ctx);
    expect(ctx.reply).toHaveBeenNthCalledWith(5, 'First window', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'To second', callback_data: 'to_second' }],
          [{ text: 'To third', callback_data: 'to_third' }],
        ],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('first');

    await router.show(ctx, 'third');
    expect(ctx.reply).toHaveBeenNthCalledWith(6, 'Third window', {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back' }]],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('third');
  });

  it('shows route after async loadData resolves', async () => {
    const needsDataRoute = r('needs_data', async ({ loadData }) => {
      const items = (await loadData()) as string[];
      return {
        text: 'needs data',
        buttons: items.map((text) => b({ text, callback: text })),
      };
    });
    const branch: RouteApi<RouteId, unknown>[] = [
      r('first', async () => ({
        text: 'First window',
        buttons: [b({ text: 'Next', callback: 'to_second', target: 'second' })],
      })),
      needsDataRoute,
    ];
    const { router } = await setupCustomRouter(branch);
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;

    await router.show(ctx, 'first');

    const loadData = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return ['delayed'];
    });

    const promise = router.show(ctx, 'needs_data', { loadData });
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    await promise;
    expect(ctx.reply).toHaveBeenNthCalledWith(2, 'needs data', {
      reply_markup: {
        inline_keyboard: [[{ text: 'delayed', callback_data: 'delayed' }]],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('needs_data');
  });

  it('does not show back button on root node', async () => {
    const { router } = await setupRouter();
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;

    await router.show(ctx, 'first');
    expect(ctx.reply).toHaveBeenCalledWith('First window', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Next', callback_data: 'to_second' }]],
      },
    });
    expect((router as any).current.get(1)?.id).toBe('first');
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

  it('registers buttons lazily for routes requiring data', async () => {
    const bot = new Telegraf<Context>('token');
    const actionSpy = vi.spyOn(bot, 'action');
    const needsDataRoute = r('needs_data', async ({ loadData }) => {
      const items = (await loadData()) as string[];
      return {
        text: 'needs data',
        buttons: items.map((text) => b({ text, callback: text })),
      };
    });
    const router = registerRoutes<RouteId>(bot, [needsDataRoute]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(actionSpy.mock.calls[0][0]).toBe('back');

    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;
    await router.show(ctx, 'needs_data', { loadData: async () => ['x'] });

    const call = actionSpy.mock.calls.find(([pattern]) => pattern === 'x');
    expect(call).toBeTruthy();
  });

  it('does nothing when data for route is missing', async () => {
    const bot = new Telegraf<Context>('token');
    const needsDataRoute = r('needs_data', async ({ loadData }) => {
      const items = (await loadData()) as string[];
      return {
        text: 'needs data',
        buttons: items.map((text) => b({ text, callback: text })),
      };
    });
    const router = registerRoutes<RouteId>(bot, [needsDataRoute]);
    const ctx = { chat: { id: 1 }, reply: vi.fn() } as unknown as Context;
    await router.show(ctx, 'needs_data');
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});

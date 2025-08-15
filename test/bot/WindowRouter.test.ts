import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import { createButton, createRoute } from '../../src/bot/router/factories';
import { WindowRouter } from '../../src/bot/WindowRouter';

function setupRouter() {
  const bot = new Telegraf<Context>('token');
  const actionSpy = vi.spyOn(bot, 'action');
  const routes = [
    createRoute('first', 'First window', () => ({
      buttons: [createButton('Next', (a, ctx) => a.show(ctx, 'second'))],
    })),
    createRoute('second', 'Second window', () => ({ buttons: [] })),
  ];
  const router = new WindowRouter(bot, routes, {} as Record<string, never>);
  return { router, actionSpy };
}

describe('WindowRouter', () => {
  it('transitions between windows and back', async () => {
    const { router, actionSpy } = setupRouter();
    await router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'first'
    );

    const goHandler = actionSpy.mock.calls.find(
      ([pattern]) => pattern !== 'back'
    )![1];
    const backHandler = actionSpy.mock.calls.find(
      ([pattern]) => pattern === 'back'
    )![1];

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
        inline_keyboard: [
          [{ text: 'Next', callback_data: expect.any(String) }],
        ],
      },
    });
  });

  it('adds back button when history exists', async () => {
    const { router, actionSpy } = setupRouter();
    await router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'first'
    );

    const goHandler = actionSpy.mock.calls.find(
      ([pattern]) => pattern !== 'back'
    )![1];

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
    const { router, actionSpy } = setupRouter();
    await router.show(
      { chat: { id: 1 }, reply: vi.fn() } as unknown as Context,
      'first'
    );

    const goHandler = actionSpy.mock.calls.find(
      ([pattern]) => pattern !== 'back'
    )![1];
    const backHandler = actionSpy.mock.calls.find(
      ([pattern]) => pattern === 'back'
    )![1];

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
    const { router } = setupRouter();
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
});

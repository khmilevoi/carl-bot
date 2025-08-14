import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import type { WindowDefinition } from '../../src/bot/windowConfig';
import { WindowRouter } from '../../src/bot/WindowRouter';

const windows: WindowDefinition[] = [
  {
    id: 'first',
    text: 'First window',
    buttons: [{ text: 'Next', callback: 'to_second', target: 'second' }],
  },
  { id: 'second', text: 'Second window', buttons: [] },
];

function setupRouter() {
  const bot = new Telegraf<Context>('token');
  const actionSpy = vi.spyOn(bot, 'action');
  new WindowRouter(
    bot,
    windows,
    {} as Record<string, (ctx: Context) => Promise<void> | void>
  );
  const goHandler = actionSpy.mock.calls.find(
    ([pattern]) => pattern === 'to_second'
  )![1];
  const backHandler = actionSpy.mock.calls.find(
    ([pattern]) => pattern === 'back'
  )![1];
  actionSpy.mockRestore();
  return { goHandler, backHandler };
}

describe('WindowRouter', () => {
  it('transitions between windows and back', async () => {
    const { goHandler, backHandler } = setupRouter();
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
    const { goHandler } = setupRouter();
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
    const { goHandler, backHandler } = setupRouter();
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
});

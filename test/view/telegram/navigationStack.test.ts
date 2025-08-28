import type { Context } from 'telegraf';
import { Telegraf } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';

import {
  createRouter,
  route,
  type RouterState,
  type StateStore,
} from '@/view/telegram/inline-router';

describe('navigation stack', () => {
  it('updates state.stack on navigate and navigateBack', async () => {
    const root = route({
      id: 'root',
      async action() {
        return { text: 'root', buttons: [] };
      },
    });
    const child = route({
      id: 'child',
      async action() {
        return { text: 'child', buttons: [] };
      },
    });

    const stateStore: StateStore = {
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

    const { run } = createRouter([{ route: root, children: [child] }], {
      stateStore,
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

    await router.navigate(ctx, child);
    let state = await stateStore.get(1, 1);
    expect(state?.stack).toEqual(['child']);

    await router.navigateBack(ctx);
    state = await stateStore.get(1, 1);
    expect(state?.stack).toEqual([]);
  });

  it('shows back button for child inheriting hasBack', async () => {
    const root = route({
      id: 'root',
      async action() {
        return { text: 'root', buttons: [] };
      },
    });
    const child = route({
      id: 'child',
      async action() {
        return { text: 'child', buttons: [] };
      },
    });

    const { run } = createRouter(
      [{ route: root, hasBack: true, children: [child] }],
      {}
    );
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

    await router.navigate(ctx, child);
    const kb = (
      ctx.reply.mock.calls[0][1] as {
        reply_markup: { inline_keyboard: unknown[] };
      }
    ).reply_markup.inline_keyboard;
    expect(kb).toEqual([
      [
        expect.objectContaining({
          text: '⬅️ Назад',
          callback_data: '__router_back__',
        }),
      ],
    ]);
  });

  it('hides back button when showBack is false', async () => {
    const root = route({
      id: 'root',
      async action() {
        return { text: 'root', buttons: [] };
      },
    });
    const child = route({
      id: 'child',
      async action() {
        return { text: 'child', buttons: [], showBack: false };
      },
    });

    const { run } = createRouter(
      [{ route: root, hasBack: true, children: [child] }],
      {}
    );
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

    await router.navigate(ctx, child);
    const kb = (
      ctx.reply.mock.calls[0][1] as {
        reply_markup: { inline_keyboard: unknown[] };
      }
    ).reply_markup.inline_keyboard;
    expect(kb).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DSL,
  cb,
  cbTok,
  createRouter,
  parseCb,
  type Button,
  type Route,
  type RouteNode,
  type StartOptions,
} from '../src/view/telegram/inline-router/inline-router';

describe('inline-router helpers', () => {
  it('cb and parseCb round-trip', () => {
    const data = cb('route', ['a', 1], 'v2');
    expect(data).toBe('route!v2:a:1');
    const parsed = parseCb(data);
    expect(parsed).toEqual({
      routeId: 'route',
      cbVersion: 'v2',
      args: ['a', '1'],
      isToken: false,
      token: undefined,
    });
  });

  it('cbTok marks tokenized payloads', async () => {
    const tokenStore = {
      save: vi.fn().mockReturnValue('tok123'),
      load: vi.fn(),
    };
    const data = await cbTok(
      'r',
      tokenStore as any,
      { big: 'payload' },
      1000,
      'v1'
    );
    expect(data).toBe('r!v1:t:tok123');
    const parsed = parseCb(data);
    expect(parsed.isToken).toBe(true);
    expect(parsed.token).toBe('tok123');
  });
});

describe('inline-router runtime API (initially failing)', () => {
  let bot: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Minimal fake Telegraf bot surface used by the router
    bot = {
      telegram: { setMyCommands: vi.fn() },
      action: vi.fn(),
      command: vi.fn(),
      on: vi.fn(),
    };
  });

  it('registers actionName handlers and sets commands', () => {
    const r1: Route = {
      id: 'home',
      actionName: 'home',
      actionDescription: 'Главное меню',
      action: vi.fn().mockResolvedValue({ text: 'Hello' }),
    };
    const tree: Array<RouteNode | Route> = [r1];
    const options: StartOptions = {
      commands: [{ command: 'menu', description: 'Показать меню' }],
    };
    const router = createRouter(tree, options);
    const running = router.run(bot, {});

    expect(bot.command).toHaveBeenCalledWith('home', expect.any(Function));
    expect(bot.telegram.setMyCommands).toHaveBeenCalled();
    expect(typeof running.onText).toBe('function');
  });

  it('navigates to a route and renders reply', async () => {
    const r: Route = {
      id: 'profile',
      actionName: 'profile',
      action: vi.fn().mockResolvedValue({
        text: 'Your profile',
        buttons: DSL.rows<Button>([
          { text: 'Back', callback: '__router_back__' },
        ]),
      }),
    };
    const router = createRouter([r]);
    const running = router.run(bot, {});

    const ctx: any = {
      chat: { id: 1 },
      from: { id: 2 },
      reply: vi.fn().mockResolvedValue({ message_id: 10 }),
      answerCbQuery: vi.fn(),
      editMessageReplyMarkup: vi.fn(),
    };

    // simulate /profile command
    const handler = vi
      .mocked(bot.command)
      .mock.calls.find((c) => c[0] === 'profile')?.[1];
    expect(handler).toBeTypeOf('function');
    await handler!(ctx);

    expect(r.action).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      'Your profile',
      expect.objectContaining({ reply_markup: expect.any(Object) })
    );

    // Use API methods exist
    await expect(running.navigateBack(ctx)).resolves.toBeUndefined();
  });

  it('handles callback_query via bot.action and per-button action + answerCbQuery', async () => {
    const btnAction = vi.fn();
    const r: Route = {
      id: 'profile',
      actionName: 'profile',
      action: vi.fn().mockResolvedValue({
        text: 'Your profile',
        buttons: DSL.rows<Button>([
          {
            text: 'Do',
            callback: 'do:ping',
            action: btnAction,
            answer: { text: 'OK', alert: false, cacheTimeSec: 1 },
          },
        ]),
      }),
    };
    const router = createRouter([r]);
    router.run(bot, {});

    const ctx: any = {
      chat: { id: 1 },
      from: { id: 2 },
      reply: vi.fn().mockResolvedValue({ message_id: 11 }),
      answerCbQuery: vi.fn(),
      editMessageReplyMarkup: vi.fn(),
    };

    // Render initial view to capture buttons in state
    const cmd = vi
      .mocked(bot.command)
      .mock.calls.find((c) => c[0] === 'profile')?.[1];
    await cmd!(ctx);

    // Simulate button press -> should call button.action and answerCbQuery with provided args
    const actHandler = vi.mocked(bot.action).mock.calls.at(-1)?.[1];
    expect(typeof actHandler).toBe('function');
    await actHandler({
      ...ctx,
      callbackQuery: { data: 'do:ping', message: { message_id: 11 } },
    });
    expect(btnAction).toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      'OK',
      expect.objectContaining({ show_alert: false, cache_time: 1 })
    );

    // Simulate route navigation callback: profile!v1
    await actHandler({
      ...ctx,
      callbackQuery: { data: 'profile!v1', message: { message_id: 11 } },
    });
    expect(r.action).toHaveBeenCalledTimes(2);
  });
});

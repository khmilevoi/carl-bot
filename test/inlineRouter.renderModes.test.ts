import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DSL,
  RouterUserError,
  createRouter,
  type Button,
  type Route,
  type RouteNode,
  type StartOptions,
} from '../src/view/telegram/inline-router';

describe('inline-router render modes and errors', () => {
  let bot: any;

  beforeEach(() => {
    vi.clearAllMocks();
    bot = {
      telegram: { setMyCommands: vi.fn() },
      action: vi.fn(),
      command: vi.fn(),
      on: vi.fn(),
    };
  });

  it('smart mode prefers edit on callback, else reply', async () => {
    const r2: Route = {
      id: 'r2',
      action: vi.fn().mockResolvedValue({ text: 'V2', renderMode: 'smart' }),
    };
    const r1: Route = {
      id: 'r1',
      actionName: 'start',
      action: vi.fn().mockResolvedValue({
        text: 'V1',
        buttons: DSL.rows<Button>([
          {
            text: 'Next',
            callback: 'next',
            action: ({ navigate }) => navigate(r2),
          },
        ]),
      }),
    };

    const tree: Array<RouteNode | Route> = [r1, r2];
    const router = createRouter(tree);
    router.run(bot as any, {});

    const ctx: any = {
      chat: { id: 1 },
      from: { id: 2 },
      reply: vi.fn().mockResolvedValue({ message_id: 100 }),
      answerCbQuery: vi.fn(),
      editMessageText: vi.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: vi.fn(),
      deleteMessage: vi.fn(),
    };

    // Start route -> reply "V1"
    const start = vi
      .mocked(bot.command)
      .mock.calls.find((c) => c[0] === 'start')?.[1];
    expect(start).toBeTypeOf('function');
    await start!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith('V1', expect.any(Object));

    // Press button -> navigate to r2 with smart mode -> expect edit
    const actHandler = vi.mocked(bot.action).mock.calls.at(-1)?.[1];
    expect(typeof actHandler).toBe('function');
    await actHandler!({
      ...ctx,
      callbackQuery: { data: 'next', message: { message_id: 100 } },
    });
    expect(ctx.editMessageText).toHaveBeenCalledWith('V2', expect.any(Object));
    // Should not add an extra reply during successful edit
    expect(vi.mocked(ctx.reply).mock.calls.length).toBe(1);
  });

  it('edit mode respects onEditFail=replace', async () => {
    const r2: Route = {
      id: 'r2',
      action: vi.fn().mockResolvedValue({ text: 'V2', renderMode: 'edit' }),
    };
    const r1: Route = {
      id: 'r1',
      actionName: 'start',
      action: vi.fn().mockResolvedValue({
        text: 'V1',
        buttons: DSL.rows<Button>([
          {
            text: 'Go',
            callback: 'go',
            action: ({ navigate }) => navigate(r2),
          },
        ]),
      }),
    };
    const options: StartOptions = { onEditFail: 'replace' };
    const router = createRouter([r1, r2], options);
    router.run(bot as any, {});

    const ctx: any = {
      chat: { id: 1 },
      from: { id: 2 },
      reply: vi.fn().mockResolvedValue({ message_id: 101 }),
      answerCbQuery: vi.fn(),
      editMessageText: vi.fn().mockRejectedValue(new Error('cannot edit')), // force failure
      editMessageReplyMarkup: vi.fn(),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    };

    const start = vi
      .mocked(bot.command)
      .mock.calls.find((c) => c[0] === 'start')?.[1];
    await start!(ctx);
    const actHandler = vi.mocked(bot.action).mock.calls.at(-1)?.[1];
    await actHandler!({
      ...ctx,
      callbackQuery: { data: 'go', message: { message_id: 101 } },
    });

    expect(ctx.editMessageText).toHaveBeenCalled();
    expect(ctx.deleteMessage).toHaveBeenCalledWith(101);
    // fallback replied
    expect(ctx.reply).toHaveBeenCalledWith('V2', expect.any(Object));
  });

  it('replace mode deletes previous message and replies', async () => {
    const r2: Route = {
      id: 'r2',
      action: vi.fn().mockResolvedValue({ text: 'V3', renderMode: 'replace' }),
    };
    const r1: Route = {
      id: 'r1',
      actionName: 'start',
      action: vi.fn().mockResolvedValue({
        text: 'Hello',
        buttons: DSL.rows<Button>([
          {
            text: 'Next',
            callback: 'next',
            action: ({ navigate }) => navigate(r2),
          },
        ]),
      }),
    };
    const router = createRouter([r1, r2]);
    router.run(bot as any, {});

    const ctx: any = {
      chat: { id: 1 },
      from: { id: 2 },
      reply: vi.fn().mockResolvedValue({ message_id: 111 }),
      answerCbQuery: vi.fn(),
      editMessageText: vi.fn(),
      editMessageReplyMarkup: vi.fn(),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    };

    const start = vi
      .mocked(bot.command)
      .mock.calls.find((c) => c[0] === 'start')?.[1];
    await start!(ctx);
    const actHandler = vi.mocked(bot.action).mock.calls.at(-1)?.[1];
    await actHandler!({
      ...ctx,
      callbackQuery: { data: 'next', message: { message_id: 111 } },
    });

    expect(ctx.deleteMessage).toHaveBeenCalledWith(111);
    expect(ctx.reply).toHaveBeenCalledWith('V3', expect.any(Object));
  });

  it('RouterUserError renders friendly view', async () => {
    const r: Route = {
      id: 'err',
      actionName: 'err',
      action: vi.fn().mockImplementation(() => {
        throw new RouterUserError('Oops', {
          text: 'Localized error',
          renderMode: 'append',
        });
      }),
    };
    const router = createRouter([r], { errorPrefix: 'ERR: ' });
    router.run(bot as any, {});

    const ctx: any = {
      chat: { id: 1 },
      from: { id: 2 },
      reply: vi.fn().mockResolvedValue({ message_id: 200 }),
      answerCbQuery: vi.fn(),
      editMessageReplyMarkup: vi.fn(),
    };

    const cmd = vi
      .mocked(bot.command)
      .mock.calls.find((c) => c[0] === 'err')?.[1];
    await cmd!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      'Localized error',
      expect.any(Object)
    );
  });
});

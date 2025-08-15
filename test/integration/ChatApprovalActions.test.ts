import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Telegraf, type Context } from 'telegraf';

import { container, init, createContext, MockTelegram } from './setup';
import { TelegramBot } from '../../src/bot/TelegramBot';
import {
  CHAT_APPROVAL_SERVICE_ID,
  type ChatApprovalService,
} from '../../src/services/chat/ChatApprovalService';

let bot: TelegramBot;
let approval: ChatApprovalService;
let handleApprove: (ctx: Context) => Promise<void>;
let handleBan: (ctx: Context) => Promise<void>;
let handleUnban: (ctx: Context) => Promise<void>;

beforeAll(async () => {
  await init();
  const actionSpy = vi.spyOn(Telegraf.prototype, 'action');
  bot = container.get(TelegramBot);
  approval = container.get(CHAT_APPROVAL_SERVICE_ID);
  const calls = actionSpy.mock.calls;
  handleApprove = calls.find(
    ([pattern]) =>
      pattern instanceof RegExp && pattern.source === '^chat_approve:(\\S+)$'
  )![1];
  handleBan = calls.find(
    ([pattern]) =>
      pattern instanceof RegExp && pattern.source === '^chat_ban:(\\S+)$'
  )![1];
  handleUnban = calls.find(
    ([pattern]) =>
      pattern instanceof RegExp && pattern.source === '^chat_unban:(\\S+)$'
  )![1];
  actionSpy.mockRestore();
});

describe('chat approval actions', () => {
  it('approves chat and notifies parties', async () => {
    const ctx = createContext({ chatId: 1 }) as Context & { match: string[] };
    ctx.match = ['chat_approve:10', '10'];
    const telegram = ctx.telegram as unknown as MockTelegram;

    await handleApprove(ctx);

    expect(await approval.getStatus(10)).toBe('approved');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Чат одобрен');
    expect(telegram.sendMessage).toHaveBeenCalledWith(10, 'Доступ разрешён');
  });

  it('bans chat and notifies parties', async () => {
    const ctx = createContext({ chatId: 1 }) as Context & { match: string[] };
    ctx.match = ['chat_ban:11', '11'];
    const telegram = ctx.telegram as unknown as MockTelegram;

    await handleBan(ctx);

    expect(await approval.getStatus(11)).toBe('banned');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Чат забанен');
    expect(telegram.sendMessage).toHaveBeenCalledWith(11, 'Доступ запрещён');
  });

  it('unbans chat and notifies parties', async () => {
    const ctx = createContext({ chatId: 1 }) as Context & { match: string[] };
    ctx.match = ['chat_unban:12', '12'];
    const telegram = ctx.telegram as unknown as MockTelegram;

    await handleUnban(ctx);

    expect(await approval.getStatus(12)).toBe('approved');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Чат разбанен');
    expect(telegram.sendMessage).toHaveBeenCalledWith(12, 'Доступ разрешён');
  });
});

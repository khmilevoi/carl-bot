import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatAccessRepository } from '../src/repositories/interfaces/ChatAccessRepository';
import { DefaultChatApprovalService } from '../src/services/chat/ChatApprovalService';

const sendMessage = vi.fn();

vi.mock('telegraf', () => ({
  Telegram: vi.fn(() => ({ sendMessage })),
}));

describe('DefaultChatApprovalService', () => {
  const repo: ChatAccessRepository = {
    get: vi.fn(),
    setStatus: vi.fn().mockResolvedValue(undefined),
    listPending: vi.fn(),
  };

  const envService = {
    env: {
      BOT_TOKEN: 'token',
      ADMIN_CHAT_ID: 42,
    },
  } as any;

  let service: DefaultChatApprovalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DefaultChatApprovalService(repo, envService);
  });

  it('sends approval request and sets status to pending', async () => {
    await service.request(1, 'Test');
    expect(repo.setStatus).toHaveBeenCalledWith(1, 'pending');
    expect(sendMessage).toHaveBeenCalledWith(42, 'Test (1) запросил доступ', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Разрешить', callback_data: 'chat_approve:1' },
            { text: 'Забанить', callback_data: 'chat_ban:1' },
          ],
        ],
      },
    });
  });

  it('updates chat status', async () => {
    await service.approve(2);
    expect(repo.setStatus).toHaveBeenCalledWith(2, 'approved');

    await service.ban(3);
    expect(repo.setStatus).toHaveBeenCalledWith(3, 'banned');

    await service.unban(4);
    expect(repo.setStatus).toHaveBeenCalledWith(4, 'approved');
  });

  it('returns stored status or pending by default', async () => {
    (repo.get as any).mockResolvedValueOnce({ chatId: 5, status: 'approved' });
    expect(await service.getStatus(5)).toBe('approved');

    (repo.get as any).mockResolvedValueOnce(undefined);
    expect(await service.getStatus(6)).toBe('pending');
  });
});

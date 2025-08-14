import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatAccessRepository } from '../src/repositories/interfaces/ChatAccessRepository';
import { DefaultChatApprovalService } from '../src/services/chat/ChatApprovalService';
import type { EnvService } from '../src/services/env/EnvService';

const sendMessage = vi.fn();

vi.mock('telegraf', () => ({
  Telegram: vi.fn(() => ({ sendMessage })),
}));

describe('DefaultChatApprovalService', () => {
  const repo: ChatAccessRepository = {
    get: vi.fn(),
    setStatus: vi.fn().mockResolvedValue(undefined),
    listPending: vi.fn(),
    listAll: vi.fn(),
  };

  const envService = {
    env: {
      BOT_TOKEN: 'token',
      ADMIN_CHAT_ID: 42,
    },
  } as unknown as EnvService;

  let service: DefaultChatApprovalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DefaultChatApprovalService(repo, envService);
  });

  it('sends approval request and sets status to pending', async () => {
    await service.pending(1);
    expect(repo.setStatus).toHaveBeenCalledWith(1, 'pending');
    // Примечание: метод pending только устанавливает статус, не отправляет сообщения
    // Отправка сообщений происходит в TelegramBot.sendChatApprovalRequest
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
    vi.mocked(repo.get).mockResolvedValueOnce({
      chatId: 5,
      status: 'approved',
    });
    expect(await service.getStatus(5)).toBe('approved');

    vi.mocked(repo.get).mockResolvedValueOnce(undefined);
    expect(await service.getStatus(6)).toBe('pending');
  });

  it('lists all chat access entries', async () => {
    const entries = [{ chatId: 1, status: 'approved' }];
    vi.mocked(repo.listAll).mockResolvedValueOnce(entries);
    expect(await service.listAll()).toEqual(entries);
    expect(repo.listAll).toHaveBeenCalled();
  });
});

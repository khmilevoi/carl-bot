import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageService } from '../src/services/messages/MessageService.interface';
import type { SummaryService } from '../src/services/summaries/SummaryService.interface';

const debug = vi.fn();
vi.mock('../src/services/logging/PinoLogger', () => ({
  PinoLogger: vi.fn().mockImplementation(() => ({
    debug,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  })),
}));

import { DefaultChatResetService } from '../src/services/chat/DefaultChatResetService';

describe('DefaultChatResetService', () => {
  const messages = {
    clearMessages: vi.fn().mockResolvedValue(undefined),
  } as unknown as MessageService;

  const summaries = {
    clearSummary: vi.fn().mockResolvedValue(undefined),
  } as unknown as SummaryService;

  let service: DefaultChatResetService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DefaultChatResetService(messages, summaries);
  });

  it('clears messages, summary and logs reset', async () => {
    const chatId = 123;
    await service.reset(chatId);
    expect(messages.clearMessages).toHaveBeenCalledWith(chatId);
    expect(summaries.clearSummary).toHaveBeenCalledWith(chatId);
    expect(debug).toHaveBeenCalledWith({ chatId }, 'Resetting chat data');
  });
});

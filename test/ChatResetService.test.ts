import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageService } from '../src/services/messages/MessageService';
import type { SummaryService } from '../src/services/summaries/SummaryService';

vi.mock('../src/services/logging/logger', () => ({
  logger: { debug: vi.fn() },
}));

import { DefaultChatResetService } from '../src/services/chat/DefaultChatResetService';
import { logger } from '../src/services/logging/logger';

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
    expect(logger.debug).toHaveBeenCalledWith(
      { chatId },
      'Resetting chat data'
    );
  });
});

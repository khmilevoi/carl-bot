import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageService } from '../src/services/messages/MessageService.interface';
import type { SummaryService } from '../src/services/summaries/SummaryService.interface';
import type { LoggerService } from '../src/services/logging/LoggerService';
import { DefaultChatResetService } from '../src/services/chat/DefaultChatResetService';

describe('DefaultChatResetService', () => {
  const messages = {
    clearMessages: vi.fn().mockResolvedValue(undefined),
  } as unknown as MessageService;

  const summaries = {
    clearSummary: vi.fn().mockResolvedValue(undefined),
  } as unknown as SummaryService;

  let service: DefaultChatResetService;
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  const loggerService: LoggerService = {
    createLogger: () => logger,
  } as unknown as LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DefaultChatResetService(messages, summaries, loggerService);
  });

  it('clears messages, summary and logs reset', async () => {
    const chatId = 123;
    await service.reset(chatId);
    expect(messages.clearMessages).toHaveBeenCalledWith(chatId);
    expect(summaries.clearSummary).toHaveBeenCalledWith(chatId);
    expect(logger.debug).toHaveBeenCalledWith(
      {
        chatId,
      },
      'Resetting chat data'
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageService } from '../src/application/interfaces/messages/MessageService.interface';
import type { SummaryService } from '../src/application/interfaces/summaries/SummaryService.interface';
import type { LoggerFactory } from '../src/application/use-cases/logging/LoggerFactory';
import { DefaultChatResetService } from '../src/application/use-cases/chat/DefaultChatResetService';

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
  const loggerFactory: LoggerFactory = {
    create: () => logger,
  } as unknown as LoggerFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DefaultChatResetService(messages, summaries, loggerFactory);
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

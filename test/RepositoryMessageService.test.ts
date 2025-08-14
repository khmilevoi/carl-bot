import { describe, expect, it, vi } from 'vitest';

import { type ChatRepository } from '../src/repositories/interfaces/ChatRepository.interface';
import { type ChatUserRepository } from '../src/repositories/interfaces/ChatUserRepository.interface';
import { type MessageRepository } from '../src/repositories/interfaces/MessageRepository.interface';
import { type UserRepository } from '../src/repositories/interfaces/UserRepository.interface';
import { RepositoryMessageService } from '../src/services/messages/RepositoryMessageService';
import { type StoredMessage } from '../src/services/messages/StoredMessage.interface';

describe('RepositoryMessageService', () => {
  it('links chat and user when adding a message', async () => {
    const chatRepo: ChatRepository = {
      upsert: vi.fn(),
    } as unknown as ChatRepository;
    const userRepo: UserRepository = {
      upsert: vi.fn(),
    } as unknown as UserRepository;
    const messageRepo: MessageRepository = {
      insert: vi.fn(),
    } as unknown as MessageRepository;
    const chatUserRepo: ChatUserRepository = {
      link: vi.fn(),
    } as unknown as ChatUserRepository;

    const service = new RepositoryMessageService(
      chatRepo,
      userRepo,
      messageRepo,
      chatUserRepo
    );

    const message: StoredMessage = {
      chatId: 123,
      role: 'user',
      content: 'hello',
      userId: 456,
    };

    await service.addMessage(message);

    expect(chatUserRepo.link).toHaveBeenCalledWith(123, 456);
  });

  it('fetches messages, counts, retrieves last and clears', async () => {
    const messageRepo: MessageRepository = {
      findByChatId: vi.fn().mockResolvedValue([]),
      countByChatId: vi.fn().mockResolvedValue(0),
      findLastByChatId: vi.fn().mockResolvedValue([]),
      clearByChatId: vi.fn(),
    } as unknown as MessageRepository;

    const service = new RepositoryMessageService(
      {} as unknown as ChatRepository,
      {} as unknown as UserRepository,
      messageRepo,
      {} as unknown as ChatUserRepository
    );

    await service.getMessages(1);
    await service.getCount(2);
    await service.getLastMessages(3, 4);
    await service.clearMessages(5);

    expect(messageRepo.findByChatId).toHaveBeenCalledWith(1);
    expect(messageRepo.countByChatId).toHaveBeenCalledWith(2);
    expect(messageRepo.findLastByChatId).toHaveBeenCalledWith(3, 4);
    expect(messageRepo.clearByChatId).toHaveBeenCalledWith(5);
  });
});

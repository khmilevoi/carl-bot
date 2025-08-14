import { describe, expect, it, vi } from 'vitest';

import { type ChatRepository } from '../src/repositories/interfaces/ChatRepository';
import { type ChatUserRepository } from '../src/repositories/interfaces/ChatUserRepository';
import { type MessageRepository } from '../src/repositories/interfaces/MessageRepository';
import { type UserRepository } from '../src/repositories/interfaces/UserRepository';
import { RepositoryMessageService } from '../src/services/messages/RepositoryMessageService';
import { type StoredMessage } from '../src/services/messages/StoredMessage';

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
});

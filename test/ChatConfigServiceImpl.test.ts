import { describe, expect, it, vi } from 'vitest';

import { RepositoryChatConfigService } from '../src/application/use-cases/chat/RepositoryChatConfigService';
import type { ChatConfigEntity } from '../src/domain/entities/ChatConfigEntity';
import type { ChatConfigRepository } from '../src/domain/repositories/ChatConfigRepository';

describe('RepositoryChatConfigService', () => {
  it('creates default config when missing', async () => {
    const repo: ChatConfigRepository = {
      findById: vi.fn(async () => undefined),
      upsert: vi.fn(async () => {}),
    };
    const service = new RepositoryChatConfigService(repo);
    const config = await service.getConfig(1);
    expect(config).toEqual({
      chatId: 1,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
    });
    expect(repo.upsert).toHaveBeenCalledWith(config);
  });

  it('sets history limit', async () => {
    const existing: ChatConfigEntity = {
      chatId: 1,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
    };
    const repo: ChatConfigRepository = {
      findById: vi.fn(async () => existing),
      upsert: vi.fn(async () => {}),
    };
    const service = new RepositoryChatConfigService(repo);
    await service.setHistoryLimit(1, 10);
    expect(repo.upsert).toHaveBeenCalledWith({ ...existing, historyLimit: 10 });
  });

  it('sets interest interval', async () => {
    const existing: ChatConfigEntity = {
      chatId: 1,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
    };
    const repo: ChatConfigRepository = {
      findById: vi.fn(async () => existing),
      upsert: vi.fn(async () => {}),
    };
    const service = new RepositoryChatConfigService(repo);
    await service.setInterestInterval(1, 20);
    expect(repo.upsert).toHaveBeenCalledWith({
      ...existing,
      interestInterval: 20,
    });
  });

  it('sets topic time', async () => {
    const existing: ChatConfigEntity = {
      chatId: 1,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
    };
    const repo: ChatConfigRepository = {
      findById: vi.fn(async () => existing),
      upsert: vi.fn(async () => {}),
    };
    const service = new RepositoryChatConfigService(repo);
    await service.setTopicTime(1, '10:30');
    expect(repo.upsert).toHaveBeenCalledWith({
      ...existing,
      topicTime: '10:30',
    });
  });

  it('clears topic time when null', async () => {
    const existing: ChatConfigEntity = {
      chatId: 1,
      historyLimit: 50,
      interestInterval: 25,
      topicTime: '09:00',
    };
    const repo: ChatConfigRepository = {
      findById: vi.fn(async () => existing),
      upsert: vi.fn(async () => {}),
    };
    const service = new RepositoryChatConfigService(repo);
    await service.setTopicTime(1, null);
    expect(repo.upsert).toHaveBeenCalledWith({
      ...existing,
      topicTime: null,
    });
  });
});

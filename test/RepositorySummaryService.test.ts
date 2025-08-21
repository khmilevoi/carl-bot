import { describe, expect, it, vi } from 'vitest';

import { type SummaryRepository } from '../src/domain/repositories/SummaryRepository.interface';
import { RepositorySummaryService } from '../src/application/use-cases/summaries/RepositorySummaryService';
import type { LoggerFactory } from '../src/application/use-cases/logging/LoggerFactory';

describe('RepositorySummaryService', () => {
  it('getSummary calls findById', async () => {
    const summaryRepo: SummaryRepository = {
      findById: vi.fn().mockResolvedValue(''),
      upsert: vi.fn(),
      clearByChatId: vi.fn(),
    } as unknown as SummaryRepository;

    const service = new RepositorySummaryService(summaryRepo, {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory);

    await service.getSummary(123);

    expect(summaryRepo.findById).toHaveBeenCalledWith(123);
  });

  it('setSummary calls upsert', async () => {
    const summaryRepo: SummaryRepository = {
      findById: vi.fn(),
      upsert: vi.fn(),
      clearByChatId: vi.fn(),
    } as unknown as SummaryRepository;

    const service = new RepositorySummaryService(summaryRepo, {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory);

    await service.setSummary(123, 'summary');

    expect(summaryRepo.upsert).toHaveBeenCalledWith(123, 'summary');
  });

  it('clearSummary calls clearByChatId', async () => {
    const summaryRepo: SummaryRepository = {
      findById: vi.fn(),
      upsert: vi.fn(),
      clearByChatId: vi.fn(),
    } as unknown as SummaryRepository;

    const service = new RepositorySummaryService(summaryRepo, {
      create: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
    } as unknown as LoggerFactory);

    await service.clearSummary(123);

    expect(summaryRepo.clearByChatId).toHaveBeenCalledWith(123);
  });
});

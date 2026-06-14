import { describe, expect, it, vi } from 'vitest';

import { DefaultFactCheckStatsService } from '../src/application/fact-checking/DefaultFactCheckStatsService';
import type { FactCheckStatsRepository } from '../src/domain/repositories/FactCheckRepository';

function makeStatsRepo(rows = []): FactCheckStatsRepository {
  return {
    getStats: vi.fn().mockResolvedValue(rows),
  } as unknown as FactCheckStatsRepository;
}

describe('DefaultFactCheckStatsService', () => {
  it('returns formatted stats report with empty rows', async () => {
    const svc = new DefaultFactCheckStatsService(makeStatsRepo());
    const result = await svc.getStatsReport(1, 'daily');
    expect(result.text).toContain('Статистика фактчека');
    expect(result.text).toContain('Подтверждено ошибок: <b>0</b>');
  });

  it('aggregates confirmed and uncertain counts correctly', async () => {
    const rows = [
      {
        authorUserId: 1,
        authorDisplayName: 'Alice',
        category: 'medical',
        status: 'confirmed',
        count: 3,
      },
      {
        authorUserId: 1,
        authorDisplayName: 'Alice',
        category: 'external_fact',
        status: 'uncertain',
        count: 2,
      },
      {
        authorUserId: 2,
        authorDisplayName: 'Bob',
        category: 'medical',
        status: 'confirmed',
        count: 1,
      },
    ];
    const svc = new DefaultFactCheckStatsService(makeStatsRepo(rows as any));
    const result = await svc.getStatsReport(1, 'weekly');
    expect(result.text).toContain('<b>4</b>'); // confirmed: 3+1
    expect(result.text).toContain('<b>2</b>'); // uncertain: 2
    expect(result.text).toContain('Alice');
    expect(result.text).toContain('Bob');
    expect(result.text).toContain('medical');
    expect(result.totalConfirmed).toBe(4);
    expect(result.totalUncertain).toBe(2);
  });

  it('calls getStats with correct chatId', async () => {
    const repo = makeStatsRepo();
    const svc = new DefaultFactCheckStatsService(repo);
    await svc.getStatsReport(999, 'monthly');
    expect(repo.getStats).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 999 })
    );
  });

  it('includes period label for monthly', async () => {
    const svc = new DefaultFactCheckStatsService(makeStatsRepo());
    const result = await svc.getStatsReport(1, 'monthly');
    expect(result.text).toContain('за месяц');
  });

  it('ranks users by confirmed errors only', async () => {
    const statsRepo = {
      getStats: vi.fn().mockResolvedValue([
        {
          authorUserId: 1,
          authorDisplayName: 'ManyUncertain',
          category: 'external_fact',
          status: 'uncertain',
          count: 10,
        },
        {
          authorUserId: 2,
          authorDisplayName: 'OneConfirmed',
          category: 'external_fact',
          status: 'confirmed',
          count: 1,
        },
      ]),
    } as unknown as FactCheckStatsRepository;
    const service = new DefaultFactCheckStatsService(statsRepo);

    const report = await service.getStatsReport(1, 'daily');

    const confirmedIndex = report.text.indexOf('OneConfirmed');
    const uncertainIndex = report.text.indexOf('ManyUncertain');
    expect(confirmedIndex).toBeGreaterThan(-1);
    expect(uncertainIndex).toBeGreaterThan(-1);
    expect(confirmedIndex).toBeLessThan(uncertainIndex);
  });

  it('caps the user ranking at 10 entries', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      authorUserId: i,
      authorDisplayName: `User${i}`,
      category: 'external_fact' as const,
      status: 'confirmed' as const,
      count: 15 - i,
    }));
    const statsRepo = {
      getStats: vi.fn().mockResolvedValue(rows),
    } as unknown as FactCheckStatsRepository;
    const service = new DefaultFactCheckStatsService(statsRepo);

    const report = await service.getStatsReport(1, 'daily');

    expect(report.text).toContain('User0');
    expect(report.text).toContain('User9');
    expect(report.text).not.toContain('User10');
    expect(report.text).not.toContain('User14');
  });

  it('monthly period clamps the day when the previous month is shorter', async () => {
    vi.useFakeTimers();
    // local-time constructor keeps the test timezone-independent
    vi.setSystemTime(new Date(2026, 2, 31, 12, 0, 0)); // March 31, 2026
    const statsRepo = {
      getStats: vi.fn().mockResolvedValue([]),
    } as unknown as FactCheckStatsRepository;
    const service = new DefaultFactCheckStatsService(statsRepo);

    await service.getStatsReport(1, 'monthly');

    const query = (statsRepo.getStats as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { fromIso: string };
    const from = new Date(query.fromIso);
    // Feb 2026 has 28 days: expected Feb 28, NOT Mar 3
    expect(from.getMonth()).toBe(1);
    expect(from.getDate()).toBe(28);
    vi.useRealTimers();
  });
});

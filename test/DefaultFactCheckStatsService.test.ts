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
});

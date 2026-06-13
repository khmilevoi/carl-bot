import type { ServiceIdentifier } from 'inversify';

export interface FactCheckStatsReport {
  text: string;
  totalConfirmed: number;
  totalUncertain: number;
}

export interface FactCheckStatsService {
  getStatsReport(
    chatId: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<FactCheckStatsReport>;
}

export const FACT_CHECK_STATS_SERVICE_ID = Symbol.for(
  'FactCheckStatsService'
) as ServiceIdentifier<FactCheckStatsService>;

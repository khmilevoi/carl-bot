import type { ServiceIdentifier } from 'inversify';

export interface InterestChecker {
  check(
    chatId: number
  ): Promise<{ messageId: string; message: string; why: string } | null>;
}

export const INTEREST_CHECKER_ID = Symbol.for(
  'InterestChecker'
) as ServiceIdentifier<InterestChecker>;

export interface PromptService {
  getPersona(): Promise<string>;
  getAskSummaryPrompt(summary: string): string;
  getSummarizationSystemPrompt(): string;
  getPreviousSummaryPrompt(prev: string): string;
  getUserPrompt(
    userName: string,
    userMessage: string,
    replyMessage?: string
  ): string;
}

import type { ServiceIdentifier } from 'inversify';

export const PROMPT_SERVICE_ID = Symbol.for(
  'PromptService'
) as ServiceIdentifier<PromptService>;

export interface PromptService {
  getPersona(): Promise<string>;
  getPriorityRulesSystemPrompt(): Promise<string>;
  getUserPromptSystemPrompt(): Promise<string>;
  getAskSummaryPrompt(summary: string): Promise<string>;
  getSummarizationSystemPrompt(): Promise<string>;
  getPreviousSummaryPrompt(prev: string): Promise<string>;
  getInterestCheckPrompt(): Promise<string>;
  getAssessUsersPrompt(): Promise<string>;
  getUserPrompt(
    userMessage: string,
    messageId?: string,
    userName?: string,
    fullName?: string,
    replyMessage?: string,
    quoteMessage?: string
  ): Promise<string>;
  getUserAttitudesPrompt(
    users: { username: string; attitude: string }[]
  ): Promise<string>;
  getUserNamesPrompt(
    users: { username: string; firstName: string; lastName: string }[]
  ): Promise<string>;
  getTriggerPrompt(
    triggerReason: string,
    triggerMessage: string
  ): Promise<string>;
}

import type { ServiceIdentifier } from 'inversify';

export const PROMPT_SERVICE_ID = Symbol.for(
  'PromptService'
) as ServiceIdentifier<PromptService>;

export interface PromptTemplateService {
  getPersonaTemplate(): Promise<string>;
  getUsersTemplate(): Promise<string>;
  getRestrictionsTemplate(): Promise<string>;
  getAskSummaryTemplate(): Promise<string>;
  getSummarizationSystemTemplate(): Promise<string>;
  getPreviousSummaryTemplate(): Promise<string>;
  getInterestCheckTemplate(): Promise<string>;
  getUserPromptTemplate(): Promise<string>;
  getUserPromptSystemTemplate(): Promise<string>;
  getPriorityRulesSystemTemplate(): Promise<string>;
  getAssessUsersTemplate(): Promise<string>;
  getReplyTriggerTemplate(): Promise<string>;
}

import type { ServiceIdentifier } from 'inversify';

export const PROMPT_TEMPLATE_SERVICE_ID = Symbol.for(
  'PromptTemplateService'
) as ServiceIdentifier<PromptTemplateService>;

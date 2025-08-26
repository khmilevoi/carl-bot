import { inject, injectable } from 'inversify';

import type { PromptService } from '@/application/interfaces/prompts/PromptService';
import type { PromptTemplateService } from '@/application/interfaces/prompts/PromptTemplateService';
import { PROMPT_TEMPLATE_SERVICE_ID } from '@/application/interfaces/prompts/PromptTemplateService';

@injectable()
export class FilePromptService implements PromptService {
  constructor(
    @inject(PROMPT_TEMPLATE_SERVICE_ID)
    private readonly templates: PromptTemplateService
  ) {}

  async getPersona(): Promise<string> {
    return this.templates.getPersonaTemplate();
  }

  async getPriorityRulesSystemPrompt(): Promise<string> {
    return this.templates.getPriorityRulesSystemTemplate();
  }

  async getUserPromptSystemPrompt(): Promise<string> {
    return this.templates.getUserPromptSystemTemplate();
  }

  async getAskSummaryPrompt(summary: string): Promise<string> {
    const template = await this.templates.getAskSummaryTemplate();
    return template.replace('{{summary}}', summary);
  }

  async getSummarizationSystemPrompt(): Promise<string> {
    return this.templates.getSummarizationSystemTemplate();
  }

  async getPreviousSummaryPrompt(prev: string): Promise<string> {
    const template = await this.templates.getPreviousSummaryTemplate();
    return template.replace('{{prev}}', prev);
  }

  async getInterestCheckPrompt(): Promise<string> {
    return this.templates.getInterestCheckTemplate();
  }

  async getAssessUsersPrompt(): Promise<string> {
    return this.templates.getAssessUsersTemplate();
  }

  async getUserPrompt(
    userMessage: string,
    messageId?: string,
    userName?: string,
    fullName?: string,
    replyMessage?: string,
    quoteMessage?: string,
    attitude?: string
  ): Promise<string> {
    const template = await this.templates.getUserPromptTemplate();
    const prompt = template
      .replace('{{messageId}}', messageId ?? 'N/A')
      .replace('{{userMessage}}', userMessage)
      .replace('{{userName}}', userName ?? 'N/A')
      .replace('{{fullName}}', fullName ?? 'N/A')
      .replace('{{replyMessage}}', replyMessage ?? 'N/A')
      .replace('{{quoteMessage}}', quoteMessage ?? 'N/A')
      .replace('{{attitude}}', attitude ?? '');

    return prompt;
  }

  async getTriggerPrompt(
    triggerReason: string,
    triggerMessage: string
  ): Promise<string> {
    const template = await this.templates.getReplyTriggerTemplate();

    const prompt = template
      .replace('{{triggerReason}}', triggerReason)
      .replace('{{triggerMessage}}', triggerMessage);

    return prompt;
  }
}

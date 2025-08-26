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
    return this.templates.loadTemplate('persona');
  }

  async getPriorityRulesSystemPrompt(): Promise<string> {
    return this.templates.loadTemplate('priorityRulesSystem');
  }

  async getUserPromptSystemPrompt(): Promise<string> {
    return this.templates.loadTemplate('userPromptSystem');
  }

  async getAskSummaryPrompt(summary: string): Promise<string> {
    const template = await this.templates.loadTemplate('askSummary');
    return template.replace('{{summary}}', summary);
  }

  async getSummarizationSystemPrompt(): Promise<string> {
    return this.templates.loadTemplate('summarizationSystem');
  }

  async getPreviousSummaryPrompt(prev: string): Promise<string> {
    const template = await this.templates.loadTemplate('previousSummary');
    return template.replace('{{prev}}', prev);
  }

  async getInterestCheckPrompt(): Promise<string> {
    return this.templates.loadTemplate('checkInterest');
  }

  async getAssessUsersPrompt(): Promise<string> {
    return this.templates.loadTemplate('assessUsers');
  }

  async getUserPrompt(
    userMessage: string,
    messageId?: string,
    userName?: string,
    fullName?: string,
    replyMessage?: string,
    quoteMessage?: string
  ): Promise<string> {
    const template = await this.templates.loadTemplate('userPrompt');
    const prompt = template
      .replace('{{messageId}}', messageId ?? 'N/A')
      .replace('{{userMessage}}', userMessage)
      .replace('{{userName}}', userName ?? 'N/A')
      .replace('{{fullName}}', fullName ?? 'N/A')
      .replace('{{replyMessage}}', replyMessage ?? 'N/A')
      .replace('{{quoteMessage}}', quoteMessage ?? 'N/A');

    return prompt;
  }

  async getChatUsersPrompt(
    users: { username: string; fullName: string; attitude: string }[]
  ): Promise<string> {
    const template = await this.templates.loadTemplate('chatUser');
    const formatted = users
      .map((u) =>
        template
          .replace('{{userName}}', u.username)
          .replace('{{fullName}}', u.fullName)
          .replace('{{attitude}}', u.attitude)
      )
      .join('\n\n');
    return `Все пользователи чата:\n${formatted}`;
  }

  async getTriggerPrompt(
    triggerReason: string,
    triggerMessage: string
  ): Promise<string> {
    const template = await this.templates.loadTemplate('replyTrigger');

    const prompt = template
      .replace('{{triggerReason}}', triggerReason)
      .replace('{{triggerMessage}}', triggerMessage);

    return prompt;
  }
}

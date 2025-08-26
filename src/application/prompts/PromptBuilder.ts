import type { ServiceIdentifier } from 'inversify';

import type { PromptTemplateService } from '@/application/interfaces/prompts/PromptTemplateService';

export class PromptBuilder {
  private readonly parts: string[] = [];

  constructor(private readonly templates: PromptTemplateService) {}

  async addPersona(): Promise<this> {
    const persona = await this.templates.loadTemplate('persona');
    this.parts.push(persona);
    return this;
  }

  async addAskSummary(summary: string): Promise<this> {
    const template = await this.templates.loadTemplate('askSummary');
    this.parts.push(template.replace('{{summary}}', summary));
    return this;
  }

  async addSummarizationSystem(): Promise<this> {
    const template = await this.templates.loadTemplate('summarizationSystem');
    this.parts.push(template);
    return this;
  }

  async addPreviousSummary(summary: string): Promise<this> {
    const template = await this.templates.loadTemplate('previousSummary');
    this.parts.push(template.replace('{{prev}}', summary));
    return this;
  }

  async addCheckInterest(): Promise<this> {
    const template = await this.templates.loadTemplate('checkInterest');
    this.parts.push(template);
    return this;
  }

  async addUserPrompt(params: {
    messageId?: string;
    userName?: string;
    fullName?: string;
    replyMessage?: string;
    quoteMessage?: string;
    userMessage: string;
  }): Promise<this> {
    const template = await this.templates.loadTemplate('userPrompt');
    const prompt = template
      .replace('{{messageId}}', params.messageId ?? 'N/A')
      .replace('{{userName}}', params.userName ?? 'N/A')
      .replace('{{fullName}}', params.fullName ?? 'N/A')
      .replace('{{replyMessage}}', params.replyMessage ?? 'N/A')
      .replace('{{quoteMessage}}', params.quoteMessage ?? 'N/A')
      .replace('{{userMessage}}', params.userMessage);
    this.parts.push(prompt);
    return this;
  }

  async addUserPromptSystem(): Promise<this> {
    const template = await this.templates.loadTemplate('userPromptSystem');
    this.parts.push(template);
    return this;
  }

  async addChatUsers(
    users: { username: string; fullName: string; attitude: string }[]
  ): Promise<this> {
    if (users.length === 0) {
      return this;
    }

    const template = await this.templates.loadTemplate('chatUser');
    const formatted = users
      .map((u) =>
        template
          .replace('{{userName}}', u.username)
          .replace('{{fullName}}', u.fullName)
          .replace('{{attitude}}', u.attitude)
      )
      .join('\n\n');
    this.parts.push(`Все пользователи чата:\n${formatted}`);
    return this;
  }

  async addPriorityRulesSystem(): Promise<this> {
    const restrictions = await this.templates.loadTemplate(
      'priorityRulesSystem'
    );
    this.parts.push(restrictions);
    return this;
  }

  async addAssessUsers(): Promise<this> {
    const template = await this.templates.loadTemplate('assessUsers');
    this.parts.push(template);
    return this;
  }

  async addReplyTrigger(reason: string, message: string): Promise<this> {
    const template = await this.templates.loadTemplate('replyTrigger');
    const prompt = template
      .replace('{{triggerReason}}', reason)
      .replace('{{triggerMessage}}', message);
    this.parts.push(prompt);
    return this;
  }

  build(): string {
    return this.parts.join('\n\n');
  }
}

export type PromptBuilderFactory = () => PromptBuilder;

export const PROMPT_BUILDER_FACTORY_ID = Symbol.for(
  'PromptBuilderFactory'
) as ServiceIdentifier<PromptBuilderFactory>;

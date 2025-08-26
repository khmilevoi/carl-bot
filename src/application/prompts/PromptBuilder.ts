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

  async addUsers(
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

  async addRestrictions(): Promise<this> {
    const restrictions = await this.templates.loadTemplate(
      'priorityRulesSystem'
    );
    this.parts.push(restrictions);
    return this;
  }

  async addSummary(summary: string): Promise<this> {
    const template = await this.templates.loadTemplate('previousSummary');
    this.parts.push(template.replace('{{prev}}', summary));
    return this;
  }

  async addTrigger(reason: string, message: string): Promise<this> {
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

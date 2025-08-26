import { inject, injectable, type ServiceIdentifier } from 'inversify';

import {
  PROMPT_TEMPLATE_SERVICE_ID,
  type PromptTemplateService,
} from '@/application/interfaces/prompts/PromptTemplateService';

@injectable()
export class PromptBuilder {
  private readonly parts: string[] = [];

  private readonly steps: Array<() => Promise<void>> = [];

  constructor(
    @inject(PROMPT_TEMPLATE_SERVICE_ID)
    private readonly templates: PromptTemplateService
  ) {}

  addPersona(): this {
    this.steps.push(async () => {
      const persona = await this.templates.loadTemplate('persona');
      this.parts.push(persona);
    });
    return this;
  }

  addAskSummary(summary: string): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('askSummary');
      this.parts.push(template.replace('{{summary}}', summary));
    });
    return this;
  }

  addSummarizationSystem(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('summarizationSystem');
      this.parts.push(template);
    });
    return this;
  }

  addPreviousSummary(summary: string): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('previousSummary');
      this.parts.push(template.replace('{{prev}}', summary));
    });
    return this;
  }

  addCheckInterest(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('checkInterest');
      this.parts.push(template);
    });
    return this;
  }

  addUserPrompt(params: {
    messageId?: string;
    userName?: string;
    fullName?: string;
    replyMessage?: string;
    quoteMessage?: string;
    userMessage: string;
  }): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('userPrompt');
      const prompt = template
        .replace('{{messageId}}', params.messageId ?? 'N/A')
        .replace('{{userName}}', params.userName ?? 'N/A')
        .replace('{{fullName}}', params.fullName ?? 'N/A')
        .replace('{{replyMessage}}', params.replyMessage ?? 'N/A')
        .replace('{{quoteMessage}}', params.quoteMessage ?? 'N/A')
        .replace('{{userMessage}}', params.userMessage);
      this.parts.push(prompt);
    });
    return this;
  }

  addUserPromptSystem(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('userPromptSystem');
      this.parts.push(template);
    });
    return this;
  }

  addChatUsers(
    users: { username: string; fullName: string; attitude: string }[]
  ): this {
    if (users.length === 0) {
      return this;
    }

    this.steps.push(async () => {
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
    });
    return this;
  }

  addPriorityRulesSystem(): this {
    this.steps.push(async () => {
      const restrictions = await this.templates.loadTemplate(
        'priorityRulesSystem'
      );
      this.parts.push(restrictions);
    });
    return this;
  }

  addAssessUsers(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('assessUsers');
      this.parts.push(template);
    });
    return this;
  }

  addReplyTrigger(reason: string, message: string): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('replyTrigger');
      const prompt = template
        .replace('{{triggerReason}}', reason)
        .replace('{{triggerMessage}}', message);
      this.parts.push(prompt);
    });
    return this;
  }

  async build(): Promise<string> {
    for (const step of this.steps) {
      await step();
    }
    return this.parts.join('\n\n');
  }
}

export type PromptBuilderFactory = () => PromptBuilder;

export const PROMPT_BUILDER_FACTORY_ID = Symbol.for(
  'PromptBuilderFactory'
) as ServiceIdentifier<PromptBuilderFactory>;

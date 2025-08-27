import { inject, injectable, type ServiceIdentifier } from 'inversify';

import {
  PROMPT_TEMPLATE_SERVICE_ID,
  type PromptTemplateService,
} from '@/application/interfaces/prompts/PromptTemplateService';
import type { ChatMessage } from '@/domain/messages/ChatMessage';

import type { PromptMessage } from './PromptMessage';

@injectable()
export class PromptBuilder {
  private readonly steps: Array<() => Promise<PromptMessage[]>> = [];

  constructor(
    @inject(PROMPT_TEMPLATE_SERVICE_ID)
    private readonly templates: PromptTemplateService
  ) {}

  addPersona(): this {
    this.steps.push(async () => {
      const persona = await this.templates.loadTemplate('persona');
      return [{ role: 'system', content: persona }];
    });
    return this;
  }

  addAskSummary(summary?: string): this {
    if (!summary) {
      return this;
    }
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('askSummary');
      return [
        { role: 'system', content: template.replace('{{summary}}', summary) },
      ];
    });
    return this;
  }

  addSummarizationSystem(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('summarizationSystem');
      return [{ role: 'system', content: template }];
    });
    return this;
  }

  addPreviousSummary(summary?: string): this {
    if (!summary) {
      return this;
    }
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('previousSummary');
      return [
        { role: 'system', content: template.replace('{{prev}}', summary) },
      ];
    });
    return this;
  }

  addCheckInterest(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('checkInterest');
      return [{ role: 'system', content: template }];
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
    role?: 'user' | 'assistant';
  }): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('userPrompt');
      const content = template
        .replace('{{messageId}}', params.messageId ?? 'N/A')
        .replace('{{userName}}', params.userName ?? 'N/A')
        .replace('{{fullName}}', params.fullName ?? 'N/A')
        .replace('{{replyMessage}}', params.replyMessage ?? 'N/A')
        .replace('{{quoteMessage}}', params.quoteMessage ?? 'N/A')
        .replace('{{userMessage}}', params.userMessage);
      return [{ role: params.role ?? 'user', content }];
    });
    return this;
  }

  addUserPromptSystem(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('userPromptSystem');
      return [{ role: 'system', content: template }];
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
      return [
        { role: 'system', content: `Все пользователи чата:\n${formatted}` },
      ];
    });
    return this;
  }

  addPriorityRulesSystem(): this {
    this.steps.push(async () => {
      const restrictions = await this.templates.loadTemplate(
        'priorityRulesSystem'
      );
      return [{ role: 'system', content: restrictions }];
    });
    return this;
  }

  addTopicOfDaySystem(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('topicOfDaySystem');
      return [{ role: 'system', content: template }];
    });
    return this;
  }

  addAssessUsers(): this {
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('assessUsers');
      return [{ role: 'system', content: template }];
    });
    return this;
  }

  addReplyTrigger(reason?: string, message?: string): this {
    if (!reason || !message) {
      return this;
    }
    this.steps.push(async () => {
      const template = await this.templates.loadTemplate('replyTrigger');
      return [
        {
          role: 'system',
          content: template
            .replace('{{triggerReason}}', reason)
            .replace('{{triggerMessage}}', message),
        },
      ];
    });
    return this;
  }

  addMessages(messages: ChatMessage[]): this {
    for (const msg of messages) {
      if (msg.role === 'user') {
        this.addUserPrompt({
          messageId: msg.messageId?.toString(),
          userName: msg.username,
          fullName:
            msg.fullName ??
            ([msg.firstName, msg.lastName].filter(Boolean).join(' ') ||
              undefined),
          replyMessage: msg.replyText,
          quoteMessage: msg.quoteText,
          userMessage: msg.content,
          role: 'user',
        });
      } else {
        this.addUserPrompt({
          userName: 'Ассистент',
          userMessage: msg.content,
          role: 'assistant',
        });
      }
    }
    return this;
  }

  async build(): Promise<PromptMessage[]> {
    const steps = [...this.steps];
    const parts = await Promise.all(steps.map((step) => step()));
    this.steps.length = 0;
    return parts.flat();
  }
}

export type PromptBuilderFactory = () => PromptBuilder;

export const PROMPT_BUILDER_FACTORY_ID = Symbol.for(
  'PromptBuilderFactory'
) as ServiceIdentifier<PromptBuilderFactory>;

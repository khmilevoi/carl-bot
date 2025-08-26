import { readFile } from 'fs/promises';
import { inject, injectable } from 'inversify';

import type { EnvService } from '@/application/interfaces/env/EnvService';
import { ENV_SERVICE_ID } from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import type { PromptService } from '@/application/interfaces/prompts/PromptService';
import { createLazy } from '@/utils/lazy';

@injectable()
export class FilePromptService implements PromptService {
  private readonly persona: () => Promise<string>;
  private readonly askSummaryTemplate: () => Promise<string>;
  private readonly summarizationSystemTemplate: () => Promise<string>;
  private readonly previousSummaryTemplate: () => Promise<string>;
  private readonly checkInterestTemplate: () => Promise<string>;
  private readonly userPromptTemplate: () => Promise<string>;
  private readonly userPromptSystemTemplate: () => Promise<string>;
  private readonly chatUserTemplate: () => Promise<string>;
  private readonly assessUsersTemplate: () => Promise<string>;
  private readonly priorityRulesSystemTemplate: () => Promise<string>;
  private readonly replyTriggerTemplate: () => Promise<string>;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_FACTORY_ID) private loggerFactory: LoggerFactory
  ) {
    const files = envService.getPromptFiles();
    this.logger = this.loggerFactory.create('FilePromptService');
    this.persona = createLazy(() =>
      this.loadTemplate('persona', files.persona)
    );
    this.askSummaryTemplate = createLazy(() =>
      this.loadTemplate('askSummary', files.askSummary)
    );
    this.summarizationSystemTemplate = createLazy(() =>
      this.loadTemplate('summarizationSystem', files.summarizationSystem)
    );
    this.previousSummaryTemplate = createLazy(() =>
      this.loadTemplate('previousSummary', files.previousSummary)
    );
    this.checkInterestTemplate = createLazy(() =>
      this.loadTemplate('checkInterest', files.checkInterest)
    );
    this.userPromptTemplate = createLazy(() =>
      this.loadTemplate('userPrompt', files.userPrompt)
    );
    this.userPromptSystemTemplate = createLazy(() =>
      this.loadTemplate('userPromptSystem', files.userPromptSystem)
    );
    this.chatUserTemplate = createLazy(() =>
      this.loadTemplate('chatUser', files.chatUser)
    );
    this.priorityRulesSystemTemplate = createLazy(() =>
      this.loadTemplate('priorityRulesSystem', files.priorityRulesSystem)
    );
    this.assessUsersTemplate = createLazy(() =>
      this.loadTemplate('assessUsers', files.assessUsers)
    );
    this.replyTriggerTemplate = createLazy(() =>
      this.loadTemplate('replyTrigger', files.replyTrigger)
    );
  }

  async getPersona(): Promise<string> {
    return this.persona();
  }

  async getPriorityRulesSystemPrompt(): Promise<string> {
    return this.priorityRulesSystemTemplate();
  }

  async getUserPromptSystemPrompt(): Promise<string> {
    return this.userPromptSystemTemplate();
  }

  async getAskSummaryPrompt(summary: string): Promise<string> {
    const template = await this.askSummaryTemplate();
    return template.replace('{{summary}}', summary);
  }

  async getSummarizationSystemPrompt(): Promise<string> {
    return this.summarizationSystemTemplate();
  }

  async getPreviousSummaryPrompt(prev: string): Promise<string> {
    const template = await this.previousSummaryTemplate();
    return template.replace('{{prev}}', prev);
  }

  async getInterestCheckPrompt(): Promise<string> {
    return this.checkInterestTemplate();
  }

  async getAssessUsersPrompt(): Promise<string> {
    return this.assessUsersTemplate();
  }

  async getUserPrompt(
    userMessage: string,
    messageId?: string,
    userName?: string,
    fullName?: string,
    replyMessage?: string,
    quoteMessage?: string
  ): Promise<string> {
    const template = await this.userPromptTemplate();
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
    const template = await this.chatUserTemplate();
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
    const template = await this.replyTriggerTemplate();

    const prompt = template
      .replace('{{triggerReason}}', triggerReason)
      .replace('{{triggerMessage}}', triggerMessage);

    return prompt;
  }

  private async loadTemplate(name: string, path: string): Promise<string> {
    const content = await readFile(path, 'utf-8');
    this.logger.debug(
      `Loaded ${name} template from ${path} (${Buffer.byteLength(content)} bytes)`
    );
    return content;
  }
}

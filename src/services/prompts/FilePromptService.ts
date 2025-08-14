import { readFile } from 'fs/promises';
import { inject, injectable } from 'inversify';

import { createLazy } from '../../utils/lazy';
import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import { logger } from '../logging/logger';
import { PromptService } from './PromptService';

@injectable()
export class FilePromptService implements PromptService {
  private readonly persona: () => Promise<string>;
  private readonly askSummaryTemplate: () => Promise<string>;
  private readonly summarizationSystemTemplate: () => Promise<string>;
  private readonly previousSummaryTemplate: () => Promise<string>;
  private readonly checkInterestTemplate: () => Promise<string>;
  private readonly userPromptTemplate: () => Promise<string>;
  private readonly userPromptSystemTemplate: () => Promise<string>;
  private readonly assessUsersTemplate: () => Promise<string>;
  private readonly priorityRulesSystemTemplate: () => Promise<string>;

  constructor(@inject(ENV_SERVICE_ID) envService: EnvService) {
    const files = envService.getPromptFiles();
    this.persona = createLazy(async () => {
      logger.debug('Loading persona file');
      return readFile(files.persona, 'utf-8');
    });
    this.askSummaryTemplate = createLazy(() =>
      readFile(files.askSummary, 'utf-8')
    );
    this.summarizationSystemTemplate = createLazy(() =>
      readFile(files.summarizationSystem, 'utf-8')
    );
    this.previousSummaryTemplate = createLazy(() =>
      readFile(files.previousSummary, 'utf-8')
    );
    this.checkInterestTemplate = createLazy(() =>
      readFile(files.checkInterest, 'utf-8')
    );
    this.userPromptTemplate = createLazy(() =>
      readFile(files.userPrompt, 'utf-8')
    );
    this.userPromptSystemTemplate = createLazy(() =>
      readFile(files.userPromptSystem, 'utf-8')
    );
    this.priorityRulesSystemTemplate = createLazy(() =>
      readFile(files.priorityRulesSystem, 'utf-8')
    );
    this.assessUsersTemplate = createLazy(() =>
      readFile(files.assessUsers, 'utf-8')
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
    quoteMessage?: string,
    attitude?: string
  ): Promise<string> {
    const template = await this.userPromptTemplate();
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
}

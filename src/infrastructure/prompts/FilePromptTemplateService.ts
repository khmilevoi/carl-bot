import { readFile } from 'fs/promises';
import { inject, injectable } from 'inversify';

import type { EnvService } from '@/application/interfaces/env/EnvService';
import { ENV_SERVICE_ID } from '@/application/interfaces/env/EnvService';
import type { Logger } from '@/application/interfaces/logging/Logger';
import {
  LOGGER_FACTORY_ID,
  type LoggerFactory,
} from '@/application/interfaces/logging/LoggerFactory';
import type { PromptTemplateService } from '@/application/interfaces/prompts/PromptTemplateService';
import { createLazy } from '@/utils/lazy';

@injectable()
export class FilePromptTemplateService implements PromptTemplateService {
  private readonly persona: () => Promise<string>;
  private readonly users: () => Promise<string>;
  private readonly restrictions: () => Promise<string>;
  private readonly askSummary: () => Promise<string>;
  private readonly summarizationSystem: () => Promise<string>;
  private readonly previousSummary: () => Promise<string>;
  private readonly checkInterest: () => Promise<string>;
  private readonly userPrompt: () => Promise<string>;
  private readonly userPromptSystem: () => Promise<string>;
  private readonly priorityRulesSystem: () => Promise<string>;
  private readonly assessUsers: () => Promise<string>;
  private readonly replyTrigger: () => Promise<string>;
  private readonly logger: Logger;

  constructor(
    @inject(ENV_SERVICE_ID) envService: EnvService,
    @inject(LOGGER_FACTORY_ID) loggerFactory: LoggerFactory
  ) {
    const files = envService.getPromptFiles();
    this.logger = loggerFactory.create('FilePromptTemplateService');
    this.persona = createLazy(() =>
      this.loadTemplate('persona', files.persona)
    );
    // These templates may not have separate files; reuse existing ones if needed
    this.users = createLazy(() =>
      this.loadTemplate('users', files.assessUsers)
    );
    this.restrictions = createLazy(() =>
      this.loadTemplate('restrictions', files.priorityRulesSystem)
    );
    this.askSummary = createLazy(() =>
      this.loadTemplate('askSummary', files.askSummary)
    );
    this.summarizationSystem = createLazy(() =>
      this.loadTemplate('summarizationSystem', files.summarizationSystem)
    );
    this.previousSummary = createLazy(() =>
      this.loadTemplate('previousSummary', files.previousSummary)
    );
    this.checkInterest = createLazy(() =>
      this.loadTemplate('checkInterest', files.checkInterest)
    );
    this.userPrompt = createLazy(() =>
      this.loadTemplate('userPrompt', files.userPrompt)
    );
    this.userPromptSystem = createLazy(() =>
      this.loadTemplate('userPromptSystem', files.userPromptSystem)
    );
    this.priorityRulesSystem = createLazy(() =>
      this.loadTemplate('priorityRulesSystem', files.priorityRulesSystem)
    );
    this.assessUsers = createLazy(() =>
      this.loadTemplate('assessUsers', files.assessUsers)
    );
    this.replyTrigger = createLazy(() =>
      this.loadTemplate('replyTrigger', files.replyTrigger)
    );
  }

  async getPersonaTemplate(): Promise<string> {
    return this.persona();
  }

  async getUsersTemplate(): Promise<string> {
    return this.users();
  }

  async getRestrictionsTemplate(): Promise<string> {
    return this.restrictions();
  }

  async getAskSummaryTemplate(): Promise<string> {
    return this.askSummary();
  }

  async getSummarizationSystemTemplate(): Promise<string> {
    return this.summarizationSystem();
  }

  async getPreviousSummaryTemplate(): Promise<string> {
    return this.previousSummary();
  }

  async getInterestCheckTemplate(): Promise<string> {
    return this.checkInterest();
  }

  async getUserPromptTemplate(): Promise<string> {
    return this.userPrompt();
  }

  async getUserPromptSystemTemplate(): Promise<string> {
    return this.userPromptSystem();
  }

  async getPriorityRulesSystemTemplate(): Promise<string> {
    return this.priorityRulesSystem();
  }

  async getAssessUsersTemplate(): Promise<string> {
    return this.assessUsers();
  }

  async getReplyTriggerTemplate(): Promise<string> {
    return this.replyTrigger();
  }

  private async loadTemplate(name: string, path: string): Promise<string> {
    const content = await readFile(path, 'utf-8');
    this.logger.debug(
      `Loaded ${name} template from ${path} (${Buffer.byteLength(content)} bytes)`
    );
    return content;
  }
}

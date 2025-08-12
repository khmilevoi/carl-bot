import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { inject, injectable } from 'inversify';

import { ENV_SERVICE_ID, EnvService } from '../env/EnvService';
import logger from '../logging/logger';
import { PromptService } from './PromptService';

@injectable()
export class FilePromptService implements PromptService {
  private persona: string | null = null;
  private personaFile: string;
  private askSummaryTemplate: string;
  private summarizationSystemTemplate: string;
  private previousSummaryTemplate: string;
  private userPromptTemplate: string;
  private userPromptSystemTemplate: string;

  constructor(@inject(ENV_SERVICE_ID) envService: EnvService) {
    const files = envService.getPromptFiles();
    this.personaFile = files.persona;
    this.askSummaryTemplate = readFileSync(files.askSummary, 'utf-8');
    this.summarizationSystemTemplate = readFileSync(
      files.summarizationSystem,
      'utf-8'
    );
    this.previousSummaryTemplate = readFileSync(files.previousSummary, 'utf-8');
    this.userPromptTemplate = readFileSync(files.userPrompt, 'utf-8');
    this.userPromptSystemTemplate = readFileSync(
      files.userPromptSystem,
      'utf-8'
    );
  }

  private async loadPersona(): Promise<string> {
    if (!this.persona) {
      logger.debug('Loading persona file');
      this.persona = await readFile(this.personaFile, 'utf-8');
    }
    return this.persona!;
  }

  async getPersona(): Promise<string> {
    return this.loadPersona();
  }

  getUserPromptSystemPrompt(): string {
    return this.userPromptSystemTemplate;
  }

  getAskSummaryPrompt(summary: string): string {
    return this.askSummaryTemplate.replace('{{summary}}', summary);
  }

  getSummarizationSystemPrompt(): string {
    return this.summarizationSystemTemplate;
  }

  getPreviousSummaryPrompt(prev: string): string {
    return this.previousSummaryTemplate.replace('{{prev}}', prev);
  }

  getUserPrompt(
    userMessage: string,
    userName?: string,
    fullName?: string,
    replyMessage?: string,
    quoteMessage?: string
  ): string {
    const prompt = this.userPromptTemplate
      .replace('{{userMessage}}', userMessage)
      .replace('{{userName}}', userName ?? 'N/A')
      .replace('{{fullName}}', fullName ?? 'N/A')
      .replace('{{replyMessage}}', replyMessage ?? 'N/A')
      .replace('{{quoteMessage}}', quoteMessage ?? 'N/A');

    return prompt;
  }
}

import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { injectable } from 'inversify';

import logger from '../logging/logger';
import { PromptService } from './PromptService';

@injectable()
export class FilePromptService implements PromptService {
  private persona: string | null = null;
  private askSummaryTemplate: string;
  private summarizationSystemTemplate: string;
  private previousSummaryTemplate: string;
  private userPromptTemplate: string;
  private userPromptSystemTemplate: string;
  private priorityRulesSystemTemplate: string;

  constructor(
    private personaFile = 'prompts/persona.md',
    askSummaryFile = 'prompts/ask_summary_prompt.md',
    summarizationSystemFile = 'prompts/summarization_system_prompt.md',
    previousSummaryFile = 'prompts/previous_summary_prompt.md',
    userPromptFile = 'prompts/user_prompt.md',
    userPromptSystemFile = 'prompts/user_prompt_system_prompt.md',
    priorityRulesSystemFile = 'prompts/priority_rules_system_prompt.md'
  ) {
    this.askSummaryTemplate = readFileSync(askSummaryFile, 'utf-8');
    this.summarizationSystemTemplate = readFileSync(
      summarizationSystemFile,
      'utf-8'
    );
    this.previousSummaryTemplate = readFileSync(previousSummaryFile, 'utf-8');
    this.userPromptTemplate = readFileSync(userPromptFile, 'utf-8');
    this.userPromptSystemTemplate = readFileSync(userPromptSystemFile, 'utf-8');
    this.priorityRulesSystemTemplate = readFileSync(
      priorityRulesSystemFile,
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

  getPriorityRulesSystemPrompt(): string {
    return this.priorityRulesSystemTemplate;
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

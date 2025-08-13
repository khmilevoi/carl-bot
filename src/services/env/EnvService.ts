import 'dotenv/config';

import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';
import { ChatModel } from 'openai/resources/shared';
import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  CHAT_HISTORY_LIMIT: z.coerce.number().int().positive().default(50),
  LOG_LEVEL: z.string().default('debug'),
  ADMIN_CHAT_ID: z.coerce.number(),
  NODE_ENV: z.string().default('development'),
  LOG_PROMPTS: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export interface EnvService {
  readonly env: Env;
  getModels(): { ask: ChatModel; summary: ChatModel };
  getWhitelistFile(): string;
  getKeywordsFile(): string;
  getPromptFiles(): {
    persona: string;
    askSummary: string;
    summarizationSystem: string;
    previousSummary: string;
    userPrompt: string;
    userPromptSystem: string;
    priorityRulesSystem: string;
  };
  getBotName(): string;
  getDialogueTimeoutMs(): number;
  getMigrationsDir(): string;
}

export const ENV_SERVICE_ID = Symbol.for(
  'EnvService'
) as ServiceIdentifier<EnvService>;

@injectable()
export class DefaultEnvService implements EnvService {
  public readonly env: Env;

  constructor() {
    this.env = envSchema.parse(process.env);
  }

  getModels() {
    return { ask: 'o3' as ChatModel, summary: 'o3-mini' as ChatModel };
  }

  getWhitelistFile(): string {
    return 'white_list.json';
  }

  getKeywordsFile(): string {
    return 'keywords.json';
  }

  getPromptFiles() {
    return {
      persona: 'prompts/persona.md',
      askSummary: 'prompts/ask_summary_prompt.md',
      summarizationSystem: 'prompts/summarization_system_prompt.md',
      previousSummary: 'prompts/previous_summary_prompt.md',
      userPrompt: 'prompts/user_prompt.md',
      userPromptSystem: 'prompts/user_prompt_system_prompt.md',
      priorityRulesSystem: 'prompts/priority_rules_system_prompt.md',
    };
  }

  getBotName(): string {
    return 'Карл';
  }

  getDialogueTimeoutMs(): number {
    return 60 * 1000;
  }

  getMigrationsDir(): string {
    return 'migrations';
  }
}

@injectable()
export class TestEnvService implements EnvService {
  public readonly env: Env;

  constructor() {
    this.env = envSchema.parse({
      BOT_TOKEN: process.env.BOT_TOKEN ?? 'test',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'test',
      DATABASE_URL: process.env.DATABASE_URL ?? 'file:///tmp/test.db',
      CHAT_HISTORY_LIMIT: process.env.CHAT_HISTORY_LIMIT,
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent',
      ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID ?? '0',
      NODE_ENV: 'test',
      LOG_PROMPTS: process.env.LOG_PROMPTS ?? 'false',
    });
  }

  getModels() {
    return { ask: 'o3' as ChatModel, summary: 'o3-mini' as ChatModel };
  }

  getWhitelistFile(): string {
    return 'white_list.json';
  }

  getKeywordsFile(): string {
    return 'keywords.json';
  }

  getPromptFiles() {
    return {
      persona: 'prompts/persona.md',
      askSummary: 'prompts/ask_summary_prompt.md',
      summarizationSystem: 'prompts/summarization_system_prompt.md',
      previousSummary: 'prompts/previous_summary_prompt.md',
      userPrompt: 'prompts/user_prompt.md',
      userPromptSystem: 'prompts/user_prompt_system_prompt.md',
      priorityRulesSystem: 'prompts/priority_rules_system_prompt.md',
    };
  }

  getBotName(): string {
    return 'Карл';
  }

  getDialogueTimeoutMs(): number {
    return 60 * 1000;
  }

  getMigrationsDir(): string {
    return 'migrations';
  }
}

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
  INTEREST_MESSAGE_INTERVAL: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

export interface EnvService {
  readonly env: Env;
  getModels(): { ask: ChatModel; summary: ChatModel; interest: ChatModel };
  getPromptFiles(): {
    persona: string;
    askSummary: string;
    summarizationSystem: string;
    previousSummary: string;
    checkInterest: string;
    userPrompt: string;
    userPromptSystem: string;
    priorityRulesSystem: string;
    assessUsers: string;
    replyTrigger: string;
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

  getModels(): { ask: ChatModel; summary: ChatModel; interest: ChatModel } {
    return {
      ask: 'o3' as ChatModel,
      summary: 'o3-mini' as ChatModel,
      interest: 'o3-mini' as ChatModel,
    };
  }

  getPromptFiles(): {
    persona: string;
    askSummary: string;
    summarizationSystem: string;
    previousSummary: string;
    checkInterest: string;
    userPrompt: string;
    userPromptSystem: string;
    priorityRulesSystem: string;
    assessUsers: string;
    replyTrigger: string;
  } {
    return {
      persona: 'prompts/persona.md',
      askSummary: 'prompts/ask_summary_prompt.md',
      summarizationSystem: 'prompts/summarization_system_prompt.md',
      previousSummary: 'prompts/previous_summary_prompt.md',
      checkInterest: 'prompts/check_interest_prompt.md',
      userPrompt: 'prompts/user_prompt.md',
      userPromptSystem: 'prompts/user_prompt_system_prompt.md',
      priorityRulesSystem: 'prompts/priority_rules_system_prompt.md',
      assessUsers: 'prompts/assess_users_prompt.md',
      replyTrigger: 'prompts/reply_trigger_prompt.md',
    };
  }

  getBotName(): string {
    return 'Карл';
  }

  getDialogueTimeoutMs(): number {
    return 2 * 60 * 1000;
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
      CHAT_HISTORY_LIMIT: process.env.CHAT_HISTORY_LIMIT ?? '50',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent',
      ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID ?? '0',
      NODE_ENV: 'test',
      INTEREST_MESSAGE_INTERVAL: process.env.INTEREST_MESSAGE_INTERVAL ?? '25',
    });
  }

  getModels(): { ask: ChatModel; summary: ChatModel; interest: ChatModel } {
    return {
      ask: 'o3' as ChatModel,
      summary: 'o3-mini' as ChatModel,
      interest: 'o3-mini' as ChatModel,
    };
  }

  getPromptFiles(): {
    persona: string;
    askSummary: string;
    summarizationSystem: string;
    previousSummary: string;
    checkInterest: string;
    userPrompt: string;
    userPromptSystem: string;
    priorityRulesSystem: string;
    assessUsers: string;
    replyTrigger: string;
  } {
    return {
      persona: 'prompts/persona.md',
      askSummary: 'prompts/ask_summary_prompt.md',
      summarizationSystem: 'prompts/summarization_system_prompt.md',
      previousSummary: 'prompts/previous_summary_prompt.md',
      checkInterest: 'prompts/check_interest_prompt.md',
      userPrompt: 'prompts/user_prompt.md',
      userPromptSystem: 'prompts/user_prompt_system_prompt.md',
      priorityRulesSystem: 'prompts/priority_rules_system_prompt.md',
      assessUsers: 'prompts/assess_users_prompt.md',
      replyTrigger: 'prompts/reply_trigger_prompt.md',
    };
  }

  getBotName(): string {
    return 'Карл';
  }

  getDialogueTimeoutMs(): number {
    return 2 * 60 * 1000;
  }

  getMigrationsDir(): string {
    return 'migrations';
  }
}

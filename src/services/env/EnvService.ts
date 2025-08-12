import 'dotenv/config';

import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';
import { ChatModel } from 'openai/resources/shared';
import { z } from 'zod';

const envSchema = z
  .object({
    BOT_TOKEN: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    CHAT_HISTORY_LIMIT: z.coerce.number().int().positive().default(50),
    LOG_LEVEL: z.string().default('debug'),
    ADMIN_CHAT_ID: z.coerce.number(),
    NODE_ENV: z.string().default('development'),
    DOMAIN: z.string().optional(),
    PORT: z.coerce.number().optional(),
    LOG_PROMPTS: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.DOMAIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DOMAIN'],
          message: 'DOMAIN is required in production',
        });
      }
      if (data.PORT === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PORT'],
          message: 'PORT is required in production',
        });
      }
    }
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
      persona: 'persona.md',
      askSummary: 'prompts/ask_summary_prompt.txt',
      summarizationSystem: 'prompts/summarization_system_prompt.txt',
      previousSummary: 'prompts/previous_summary_prompt.txt',
      userPrompt: 'prompts/user_prompt.txt',
      userPromptSystem: 'prompts/user_prompt_system_prompt.txt',
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
  public readonly env: Env = {
    BOT_TOKEN: 'test',
    OPENAI_API_KEY: 'test',
    DATABASE_URL: 'file:///tmp/test.db',
    CHAT_HISTORY_LIMIT: 50,
    LOG_LEVEL: 'silent',
    ADMIN_CHAT_ID: 0,
    NODE_ENV: 'test',
    LOG_PROMPTS: false,
  };

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
      persona: 'persona.md',
      askSummary: 'prompts/ask_summary_prompt.txt',
      summarizationSystem: 'prompts/summarization_system_prompt.txt',
      previousSummary: 'prompts/previous_summary_prompt.txt',
      userPrompt: 'prompts/user_prompt.txt',
      userPromptSystem: 'prompts/user_prompt_system_prompt.txt',
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

import type { ServiceIdentifier } from 'inversify';
import type { ChatModel } from 'openai/resources/shared';
import { z } from 'zod';

export const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  OPENAI_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default('debug'),
  ADMIN_CHAT_ID: z.coerce.number(),
  NODE_ENV: z.string().default('development'),
  LOG_PROMPTS: z.coerce.boolean().default(false),
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

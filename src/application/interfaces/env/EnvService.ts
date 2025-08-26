import type { ServiceIdentifier } from 'inversify';
import type { ChatModel } from 'openai/resources/shared';

export interface Env {
  BOT_TOKEN: string;
  OPENAI_KEY: string;
  DATABASE_URL: string;
  LOG_LEVEL: string;
  ADMIN_CHAT_ID: number;
  NODE_ENV: string;
  LOG_PROMPTS: boolean;
}

export interface PromptFiles {
  persona: string;
  askSummary: string;
  summarizationSystem: string;
  previousSummary: string;
  checkInterest: string;
  userPrompt: string;
  userPromptSystem: string;
  chatUser: string;
  priorityRulesSystem: string;
  assessUsers: string;
  replyTrigger: string;
}

export interface EnvService {
  readonly env: Env;
  getModels(): { ask: ChatModel; summary: ChatModel; interest: ChatModel };
  getPromptFiles(): PromptFiles;
  getBotName(): string;
  getDialogueTimeoutMs(): number;
  getMigrationsDir(): string;
}

export const ENV_SERVICE_ID = Symbol.for(
  'EnvService'
) as ServiceIdentifier<EnvService>;

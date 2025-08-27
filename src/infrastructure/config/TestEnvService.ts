import { injectable } from 'inversify';
import type { ChatModel } from 'openai/resources/shared';

import type {
  Env,
  EnvService,
  PromptFiles,
} from '@/application/interfaces/env/EnvService';

import { envSchema } from './envSchema';

@injectable()
export class TestEnvService implements EnvService {
  public readonly env: Env;

  constructor() {
    this.env = envSchema.parse({
      BOT_TOKEN: process.env.BOT_TOKEN ?? 'test',
      OPENAI_KEY: process.env.OPENAI_KEY ?? 'test',
      DATABASE_URL: process.env.DATABASE_URL ?? 'file:///tmp/test.db',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent',
      ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID ?? '0',
      NODE_ENV: 'test',
      LOG_PROMPTS: process.env.LOG_PROMPTS ?? false,
    });
  }

  getModels(): { ask: ChatModel; summary: ChatModel; interest: ChatModel } {
    return {
      ask: 'o3' as ChatModel,
      summary: 'o3-mini' as ChatModel,
      interest: 'o3-mini' as ChatModel,
    };
  }

  getPromptFiles(): PromptFiles {
    return {
      persona: 'prompts/persona.md',
      askSummary: 'prompts/ask_summary_prompt.md',
      summarizationSystem: 'prompts/summarization_system_prompt.md',
      previousSummary: 'prompts/previous_summary_prompt.md',
      checkInterest: 'prompts/check_interest_prompt.md',
      userPrompt: 'prompts/user_prompt.md',
      userPromptSystem: 'prompts/user_prompt_system_prompt.md',
      chatUser: 'prompts/chat_user_prompt.md',
      priorityRulesSystem: 'prompts/priority_rules_system_prompt.md',
      assessUsers: 'prompts/assess_users_prompt.md',
      replyTrigger: 'prompts/reply_trigger_prompt.md',
      topicOfDaySystem: 'prompts/topic_of_day_system_prompt.md',
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

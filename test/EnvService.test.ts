import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestEnvService } from '../src/infrastructure/config/TestEnvService';

const OLD_ENV = { ...process.env };

const setRequiredEnv = (
  overrides: Record<string, string | undefined> = {}
): void => {
  process.env.BOT_TOKEN = 'token';
  process.env.OPENAI_KEY = 'key';
  process.env.DATABASE_URL = 'file:///tmp/test.db';
  process.env.ADMIN_CHAT_ID = '1';
  Object.entries(overrides).forEach(([k, v]) => {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  });
};

describe('EnvService', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('parses environment variables and applies defaults', () => {
    setRequiredEnv({ LOG_LEVEL: undefined, LOG_PROMPTS: undefined });

    const env = new TestEnvService();

    expect(env.env.BOT_TOKEN).toBe('token');
    expect(env.env.LOG_LEVEL).toBe('silent');
    expect(env.env.LOG_PROMPTS).toBe(false);
  });

  it('getModels returns correct models', () => {
    setRequiredEnv();
    const env = new TestEnvService();
    expect(env.getModels()).toEqual({
      ask: 'o3',
      summary: 'o3-mini',
      interest: 'o3-mini',
    });
  });

  it('getPromptFiles returns default paths', () => {
    setRequiredEnv();
    const env = new TestEnvService();
    expect(env.getPromptFiles()).toEqual({
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
    });
  });

  it('getBotName returns the bot name', () => {
    setRequiredEnv();
    const env = new TestEnvService();
    expect(env.getBotName()).toBe('Карл');
  });

  it('getDialogueTimeoutMs returns timeout in ms', () => {
    setRequiredEnv();
    const env = new TestEnvService();
    expect(env.getDialogueTimeoutMs()).toBe(120_000);
  });

  it('getMigrationsDir returns migrations directory', () => {
    setRequiredEnv();
    const env = new TestEnvService();
    expect(env.getMigrationsDir()).toBe('migrations');
  });
});

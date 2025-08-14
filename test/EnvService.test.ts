import { beforeEach, describe, expect, it } from 'vitest';

import {
  DefaultEnvService,
  TestEnvService,
} from '../src/services/env/EnvService';

function setRequiredEnv(overrides: Record<string, string> = {}) {
  process.env.BOT_TOKEN = overrides.BOT_TOKEN ?? 'test';
  process.env.OPENAI_API_KEY = overrides.OPENAI_API_KEY ?? 'test';
  process.env.DATABASE_URL = overrides.DATABASE_URL ?? 'file:///tmp/test.db';
  process.env.INTEREST_MESSAGE_INTERVAL =
    overrides.INTEREST_MESSAGE_INTERVAL ?? '25';
  process.env.ADMIN_CHAT_ID = overrides.ADMIN_CHAT_ID ?? '0';
  process.env.LOG_PROMPTS = overrides.LOG_PROMPTS ?? 'false';
  if (overrides.CHAT_HISTORY_LIMIT) {
    process.env.CHAT_HISTORY_LIMIT = overrides.CHAT_HISTORY_LIMIT;
  } else {
    delete process.env.CHAT_HISTORY_LIMIT;
  }
}

describe('EnvService', () => {
  beforeEach(() => {
    delete process.env.BOT_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.INTEREST_MESSAGE_INTERVAL;
    delete process.env.CHAT_HISTORY_LIMIT;
    delete process.env.ADMIN_CHAT_ID;
    delete process.env.LOG_PROMPTS;
  });

  it('parses environment variables and applies defaults', () => {
    setRequiredEnv();
    const env = new TestEnvService();
    expect(env.env).toMatchObject({
      BOT_TOKEN: 'test',
      OPENAI_API_KEY: 'test',
      DATABASE_URL: 'file:///tmp/test.db',
      CHAT_HISTORY_LIMIT: 50,
      LOG_LEVEL: 'silent',
      NODE_ENV: 'test',
      INTEREST_MESSAGE_INTERVAL: 25,
    });
  });

  it('throws when INTEREST_MESSAGE_INTERVAL >= CHAT_HISTORY_LIMIT', () => {
    setRequiredEnv({
      CHAT_HISTORY_LIMIT: '10',
      INTEREST_MESSAGE_INTERVAL: '20',
    });
    expect(() => new DefaultEnvService()).toThrow(
      'INTEREST_MESSAGE_INTERVAL must be less than CHAT_HISTORY_LIMIT'
    );
  });

  it('throws when CHAT_HISTORY_LIMIT is not divisible by INTEREST_MESSAGE_INTERVAL', () => {
    setRequiredEnv({ CHAT_HISTORY_LIMIT: '11' });
    expect(() => new DefaultEnvService()).toThrow(
      'CHAT_HISTORY_LIMIT must be divisible by INTEREST_MESSAGE_INTERVAL'
    );
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
      priorityRulesSystem: 'prompts/priority_rules_system_prompt.md',
      assessUsers: 'prompts/assess_users_prompt.md',
      replyTrigger: 'prompts/reply_trigger_prompt.md',
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
    expect(env.getDialogueTimeoutMs()).toBe(60 * 1000);
  });

  it('getMigrationsDir returns migrations directory', () => {
    setRequiredEnv();
    const env = new TestEnvService();
    expect(env.getMigrationsDir()).toBe('migrations');
  });
});

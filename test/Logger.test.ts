import { afterEach, describe, expect, it, vi } from 'vitest';

describe('logger', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.resetModules();
  });

  it('creates logger in test env', async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    const { logger } = await import('../src/services/logging/logger');
    expect(logger).toBeDefined();
  });

  it('creates logger in non-test env', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      BOT_TOKEN: 'token',
      OPENAI_API_KEY: 'key',
      DATABASE_URL: 'file:///tmp/test.db',
      ADMIN_CHAT_ID: '1',
      INTEREST_MESSAGE_INTERVAL: '1',
      CHAT_HISTORY_LIMIT: '2',
    };
    vi.resetModules();
    const { logger } = await import('../src/services/logging/logger');
    expect(logger).toBeDefined();
  });
});

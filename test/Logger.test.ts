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
    const { createPinoLogger } = await import('../src/services/logging/logger');
    const logger = createPinoLogger();
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
    };
    vi.resetModules();
    const { createPinoLogger } = await import('../src/services/logging/logger');
    const logger = createPinoLogger();
    expect(logger).toBeDefined();
  });

  it('creates child logger with service field', async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    const { container } = await import('../src/container');
    const LoggerModule = await import('../src/services/logging/LoggerService');
    const service = container.get<LoggerModule.LoggerService>(
      LoggerModule.LOGGER_SERVICE_ID
    );
    const child = service.create({});
    expect(child.bindings()).toHaveProperty('service');
  });
});

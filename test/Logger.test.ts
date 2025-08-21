import { afterEach, describe, expect, it, vi } from 'vitest';

describe('logger', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.resetModules();
  });

  it('creates logger instance', async () => {
    const { PinoLogger } = await import('../src/services/logging/PinoLogger');
    const logger = new PinoLogger();
    expect(logger).toBeDefined();
  });

  it('creates logger via service', async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    const { container } = await import('../src/container');
    const LoggerModule = await import('../src/services/logging/LoggerFactory');
    const factory = container.get<LoggerModule.LoggerFactory>(
      LoggerModule.LOGGER_FACTORY_ID
    );
    const logger = factory.create('LoggerTest');
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');
    const child = logger.child({ service: 'test' });
    child.info('child');
    expect(typeof child.info).toBe('function');
  });
});

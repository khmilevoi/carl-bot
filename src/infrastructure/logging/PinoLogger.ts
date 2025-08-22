import pino, { type LevelWithSilent, type Logger as Pino } from 'pino';

import type { EnvService } from '../../application/interfaces/env/EnvService.interface';
import type { Logger } from '../../application/interfaces/logging/Logger.interface';

function resolveLogLevel(envService?: EnvService): LevelWithSilent {
  return (
    (envService?.env.LOG_LEVEL as LevelWithSilent | undefined) ??
    (process.env.LOG_LEVEL as LevelWithSilent | undefined) ??
    'info'
  );
}

/**
 * Logger implementation backed by Pino.
 *
 * The log level is taken from {@link EnvService.env.LOG_LEVEL} or
 * `process.env.LOG_LEVEL`. When neither is provided, it defaults to `info`.
 */
export class PinoLogger implements Logger {
  private readonly logger: Pino;
  private readonly envService?: EnvService;

  constructor(envService?: EnvService, logger?: Pino) {
    this.envService = envService;
    const level = resolveLogLevel(envService);
    this.logger = logger ?? pino({ level });
    // Ensure provided loggers also respect the resolved level
    this.logger.level = level;
  }

  debug(message: string): void;
  debug(meta: Record<string, unknown>, message: string): void;
  debug(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.logger.debug(arg1);
    } else {
      this.logger.debug(arg1, arg2 as string);
    }
  }

  info(message: string): void;
  info(meta: Record<string, unknown>, message: string): void;
  info(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.logger.info(arg1);
    } else {
      this.logger.info(arg1, arg2 as string);
    }
  }

  warn(message: string): void;
  warn(meta: Record<string, unknown>, message: string): void;
  warn(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.logger.warn(arg1);
    } else {
      this.logger.warn(arg1, arg2 as string);
    }
  }

  error(message: string): void;
  error(meta: Record<string, unknown>, message: string): void;
  error(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.logger.error(arg1);
    } else {
      this.logger.error(arg1, arg2 as string);
    }
  }

  child(meta: Record<string, unknown>): Logger {
    const childLogger = this.logger.child(meta);
    return new PinoLogger(this.envService, childLogger);
  }
}

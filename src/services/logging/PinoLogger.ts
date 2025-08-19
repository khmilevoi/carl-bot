/* eslint-disable import/no-unused-modules */
import type { Logger as Pino } from 'pino';

import { createPinoLogger } from './logger';
import type Logger from './Logger.interface';

export class PinoLogger implements Logger {
  constructor(private readonly logger: Pino = createPinoLogger()) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.debug(meta, message);
    } else {
      this.logger.debug(message);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.info(meta, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.warn(meta, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.error(meta, message);
    } else {
      this.logger.error(message);
    }
  }

  child(meta: Record<string, unknown>): Logger {
    const childLogger = this.logger.child(meta);
    return new PinoLogger(childLogger);
  }
}

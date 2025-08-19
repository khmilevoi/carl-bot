import pino, { type Logger as Pino } from 'pino';

import type Logger from './Logger.interface';

export class PinoLogger implements Logger {
  constructor(private readonly logger: Pino = pino()) {}

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
    return new PinoLogger(childLogger);
  }
}

import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';
import type { ChildLoggerOptions, Logger as PinoLogger } from 'pino';

import { createPinoLogger } from './logger';

export interface LoggerService {
  create(meta: Record<string, unknown>): PinoLogger;
}

export const LOGGER_SERVICE_ID = Symbol.for(
  'LoggerService'
) as ServiceIdentifier<LoggerService>;

const defaultBindings = { service: 'app' };

const defaultOptions: ChildLoggerOptions = {
  redact: [],
  serializers: {},
};

@injectable()
export class PinoLoggerService implements LoggerService {
  private readonly baseLogger = createPinoLogger();

  create(meta: Record<string, unknown>): PinoLogger {
    return this.baseLogger.child(
      { ...defaultBindings, ...meta },
      defaultOptions
    );
  }
}

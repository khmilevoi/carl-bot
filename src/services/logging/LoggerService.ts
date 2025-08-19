import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';

import { createPinoLogger } from './logger';
import type Logger from './Logger.interface';
import { PinoLogger } from './PinoLogger';

export interface LoggerService {
  createLogger(): Logger;
}

export const LOGGER_SERVICE_ID = Symbol.for(
  'LoggerService'
) as ServiceIdentifier<LoggerService>;

@injectable()
export class PinoLoggerService implements LoggerService {
  createLogger(): Logger {
    const logger = createPinoLogger();
    return new PinoLogger(logger);
  }
}

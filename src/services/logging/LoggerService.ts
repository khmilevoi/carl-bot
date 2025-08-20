import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';

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
    return new PinoLogger();
  }
}

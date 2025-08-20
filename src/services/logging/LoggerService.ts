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
  private readonly logger: Logger;

  constructor() {
    this.logger = new PinoLogger();
  }

  createLogger(): Logger {
    return this.logger;
  }

  getLogger(): Logger {
    return this.logger;
  }
}

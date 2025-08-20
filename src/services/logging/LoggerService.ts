import type { ServiceIdentifier } from 'inversify';
import { injectable } from 'inversify';
import pino, { type Logger as Pino } from 'pino';

import type Logger from './Logger.interface';
import { PinoLogger } from './PinoLogger';

export interface LoggerFactory {
  create(serviceName: string): Logger;
}

export const LOGGER_FACTORY_ID = Symbol.for(
  'LoggerFactory'
) as ServiceIdentifier<LoggerFactory>;

@injectable()
export class PinoLoggerFactory implements LoggerFactory {
  private readonly root: Pino;

  constructor() {
    this.root = pino();
  }

  create(serviceName: string): Logger {
    return new PinoLogger(this.root.child({ service: serviceName }));
  }
}

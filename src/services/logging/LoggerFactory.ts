import type { ServiceIdentifier } from 'inversify';
import { inject, injectable } from 'inversify';
import pino, { type LevelWithSilent, type Logger as Pino } from 'pino';

import { ENV_SERVICE_ID, type EnvService } from '../env/EnvService';
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

  constructor(@inject(ENV_SERVICE_ID) private readonly envService: EnvService) {
    const level: LevelWithSilent =
      (this.envService.env.LOG_LEVEL as LevelWithSilent | undefined) ??
      (process.env.LOG_LEVEL as LevelWithSilent | undefined) ??
      'info';
    this.root = pino({ level });
  }

  create(serviceName: string): Logger {
    return new PinoLogger(
      this.envService,
      this.root.child({ service: serviceName })
    );
  }
}

import type { ServiceIdentifier } from 'inversify';

import type { Logger } from './Logger';

export interface LoggerFactory {
  create(serviceName: string): Logger;
}

export const LOGGER_FACTORY_ID = Symbol.for(
  'LoggerFactory'
) as ServiceIdentifier<LoggerFactory>;

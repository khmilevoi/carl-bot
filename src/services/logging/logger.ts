import pino from 'pino';

import { DefaultEnvService, TestEnvService } from '../env/EnvService';

const destination = pino.destination({ sync: false });

const envService =
  process.env.NODE_ENV === 'test'
    ? new TestEnvService()
    : new DefaultEnvService();

export const logger = pino(
  {
    level: envService.env.LOG_LEVEL,
    transport: { target: 'pino-pretty' },
  },
  destination
);

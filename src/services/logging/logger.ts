import pino from 'pino';

import { DefaultEnvService, TestEnvService } from '../env/EnvService';

const destination = pino.destination({ sync: false });

export function createPinoLogger(
  options: pino.LoggerOptions = {}
): pino.Logger {
  const envService =
    process.env.NODE_ENV === 'test'
      ? new TestEnvService()
      : new DefaultEnvService();

  const baseOptions: pino.LoggerOptions = {
    level: envService.env.LOG_LEVEL,
    transport: { target: 'pino-pretty' },
  };

  return pino({ ...baseOptions, ...options }, destination);
}

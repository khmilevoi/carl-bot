import pino from 'pino';

import { DefaultEnvService } from '../env/EnvService';

const destination = pino.destination({ sync: false });

const logger = pino(
  {
    level: new DefaultEnvService().env.LOG_LEVEL,
    transport: { target: 'pino-pretty' },
  },
  destination
);

export default logger;

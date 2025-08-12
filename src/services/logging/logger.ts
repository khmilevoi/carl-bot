import pino from 'pino';

import { envService } from '../env/EnvService';

const destination = pino.destination({ sync: false });

const logger = pino(
  {
    level: envService.env.LOG_LEVEL,
    transport: { target: 'pino-pretty' },
  },
  destination
);

export default logger;

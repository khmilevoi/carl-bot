import pino from 'pino';

const destination = pino.destination({ sync: false });

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'debug',
    transport: { target: 'pino-pretty' },
  },
  destination
);

export default logger;

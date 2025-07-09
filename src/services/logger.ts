import pino from 'pino';

// Configure pino with asynchronous logging
// Using pino.destination with sync:false ensures writes are non-blocking
const destination = pino.destination({ sync: false });

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'debug',
    transport: { target: 'pino-pretty' },
  },
  destination
);

export default logger;

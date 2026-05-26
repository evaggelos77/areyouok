const pino = require('pino');

function createLogger() {
  const isProd = process.env.NODE_ENV === 'production';
  return pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
  });
}

module.exports = { createLogger };

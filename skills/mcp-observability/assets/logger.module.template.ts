// Targets: nestjs-pino ^4.x, pino-http ^10.x
// Copy the LoggerModule.forRoot call into AppModule.imports.
// Install pino-pretty as a devDependency for local development.

import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

export const PinoLoggerModule = LoggerModule.forRoot({
  pinoHttp: {
    // Log level from environment; default to 'info'
    level: process.env.LOG_LEVEL ?? 'info',

    // Human-readable output in development; raw JSON in production
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,

    // Add a unique request ID to every log line for correlation
    genReqId: (req: IncomingMessage) =>
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),

    // Custom log level based on response status
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    // Redact sensitive fields — remove entirely rather than replacing with '[Redacted]'
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        '*.password',
        '*.passwd',
        '*.token',
        '*.secret',
        '*.access_token',
        '*.refresh_token',
        '*.api_key',
        '*.apiKey',
        '*.client_secret',
        '*.private_key',
        '*.privateKey',
        '*.jwt',
      ],
      remove: true,
    },

    // Suppress noisy health-check logs
    autoLogging: {
      ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
    },
  },
});

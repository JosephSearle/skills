# Structured Logging with Pino

**Authority:** docs.nestjs.com/techniques/logger, getpino.io

---

## Install

```bash
npm install nestjs-pino pino-http
npm install --save-dev pino-pretty
```

---

## AppModule Setup

```typescript
// app.module.ts
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('NODE_ENV') === 'production' ? 'info' : 'debug',

          // Redact sensitive fields — applied before serialization
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              '*.password',
              '*.passwordHash',
              '*.refreshToken',
              '*.accessToken',
              '*.apiKey',
              '*.creditCardNumber',
            ],
            censor: '[REDACTED]',
          },

          // Request ID = correlation ID
          genReqId: (req) =>
            (req.headers['x-trace-id'] as string | undefined) ?? uuidv4(),

          // Pretty print in development only
          transport:
            configService.get('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,

          // Customize the log entry for each request
          customLogLevel: (_req, res) => {
            if (res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },

          // Suppress logging for health check endpoints
          autoLogging: {
            ignore: (req) => req.url?.startsWith('/health') ?? false,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

## Replace Default NestJS Logger in main.ts

```typescript
// main.ts
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger)); // replaces NestJS's default ConsoleLogger
  // ...
}
```

`bufferLogs: true` holds NestJS's own bootstrap logs until Pino is ready, so they're formatted consistently.

---

## Correlation ID Propagation

`nestjs-pino` uses `pino-http` to create a child logger per request in AsyncLocalStorage. Every log call within the request lifecycle automatically includes the request ID — no manual context threading needed.

The correlation ID flows automatically through:
- Guard logs
- Service logs
- Repository logs

In the exception filter, read the trace ID for the error response:

```typescript
const traceId = request.id; // pino-http sets this from genReqId
```

---

## Injecting the Logger in Services

```typescript
import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

@Injectable()
export class UsersService {
  constructor(private readonly logger: Logger) {}

  async findOne(id: string): Promise<User> {
    this.logger.log({ userId: id }, 'Fetching user'); // structured fields

    const user = await this.usersRepository.findById(id);
    if (!user) {
      this.logger.warn({ userId: id }, 'User not found');
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }
}
```

---

## Log Levels by Environment

| Environment | Log level | Rationale |
|-------------|-----------|-----------|
| `development` | `debug` | Full verbosity for local debugging |
| `test` | `silent` | Suppress log noise in test output |
| `staging` | `info` | Production-like, but allow info-level events |
| `production` | `info` (or `warn`) | Keep logs meaningful; `warn` if volume is high |

---

## What NOT to Log

Configure `redact` to enforce this automatically — do not rely on developers remembering:

```
passwords / passwordHash
tokens: accessToken, refreshToken, apiKey, idToken
Authorization header value
Cookie header value
Credit card numbers
PII: SSN, date of birth, passport numbers
Full request body on auth endpoints
```

Any log shipped to a log aggregator (Datadog, ELK, CloudWatch) is potentially accessible by many people. Treat logs as semi-public.

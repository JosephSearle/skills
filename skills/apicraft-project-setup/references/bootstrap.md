# Bootstrap — main.ts and Core Configuration

**Authority:** docs.nestjs.com/techniques/configuration, docs.nestjs.com/techniques/validation

---

## main.ts — Production Baseline

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging — replace default NestJS logger
  app.useLogger(app.get(PinoLogger));

  // Security headers
  app.use(helmet());

  // CORS — configure origins from config
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string[]>('cors.origins', []),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global error filter — RFC 9457
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // URI versioning
  app.enableVersioning();

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application running on port ${port}`);
}

bootstrap();
```

---

## @nestjs/config with Zod Boot-Time Validation

The app must refuse to start when required environment variables are missing or malformed. Silent fallbacks cause production incidents.

```typescript
// src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),

  REDIS_URL: z.string().url().optional(),

  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .default(''),
});

export type Env = z.infer<typeof envSchema>;
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          console.error('❌ Invalid environment configuration:');
          console.error(result.error.format());
          process.exit(1);
        }
        return result.data;
      },
    }),
  ],
})
export class AppModule {}
```

The app exits at boot with a clear error message if any required env var is absent or malformed.

---

## Helmet Configuration

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }),
);
```

---

## Throttler (Rate Limiting)

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// In AppModule imports:
ThrottlerModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    throttlers: [
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 10,   // 10 requests per second
      },
      {
        name: 'long',
        ttl: 60000,  // 1 minute
        limit: 100,  // 100 requests per minute
      },
    ],
  }),
  inject: [ConfigService],
}),

// In AppModule providers:
{ provide: APP_GUARD, useExisting: ThrottlerGuard },
ThrottlerGuard,
```

> ⚠️ **Gotcha:** The default `@nestjs/throttler` stores rate limit state in memory — it doesn't share across multiple app instances. In a horizontally scaled deployment, each instance has its own counter, so the effective limit is `limit * instance_count`. Use a Redis storage provider for distributed rate limiting:

```bash
npm install @nestjs-throttler-storage-redis ioredis
```

```typescript
import { ThrottlerStorageRedisService } from '@nestjs-throttler-storage-redis';

ThrottlerModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    storage: new ThrottlerStorageRedisService(configService.get('REDIS_URL')),
    throttlers: [{ name: 'global', ttl: 60000, limit: 100 }],
  }),
  inject: [ConfigService],
}),
```

→ See `apicraft-security` for OWASP API4 (Unrestricted Resource Consumption) context.

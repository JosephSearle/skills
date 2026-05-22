# NestJS Module Layout Reference

## Standard src/ Tree

```
src/
  main.ts                         # entry point — tracing.ts MUST be imported first
  app.module.ts                   # root module: wires all feature modules
  config/
    env.schema.ts                 # Zod schema for ConfigModule.forRoot({ validate })
  mcp/
    tools/                        # @Injectable() tool providers
    resources/                    # @Injectable() resource providers (if used)
    prompts/                      # @Injectable() prompt providers (if used)
    guards/                       # CanActivate guards (JWT, API key)
    interceptors/                 # NestInterceptors (audit log, timing)
    filters/                      # ExceptionFilters (MCP error mapping)
    mcp.module.ts                 # feature module: imports + exports McpModule
  health/
    health.controller.ts          # @nestjs/terminus /healthz and /readyz
  logging/
    logger.module.ts              # nestjs-pino LoggerModule configuration
  observability/
    tracing.ts                    # OpenTelemetry NodeSDK — FIRST import in main.ts
  authz/                          # Optional: OAuth IdP via McpAuthModule
```

---

## Bootstrap Order (main.ts)

The import order in `main.ts` is load-order-sensitive.

```ts
// 1. OTel MUST instrument before any module loads
import './observability/tracing';

// 2. Framework bootstrap
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // 3. Replace default logger with pino
  app.useLogger(app.get(Logger));

  // 4. Global validation for non-tool DTOs
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // 5. Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**Why tracing first:** `@opentelemetry/sdk-node` patches Node.js HTTP, `net`, `dns`, and other core modules at import time. Any module imported before it will not be instrumented.

---

## AppModule Wiring

```ts
@Module({
  imports: [
    // Config — validates env vars at startup via Zod schema
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    // Logging — must be before McpModule so pino logger is available
    LoggerModule.forRoot({ ... }),

    // MCP core
    McpModule.forRoot({
      name: process.env.MCP_SERVER_NAME,
      version: '1.0.0',
      transport: [STREAMABLE_HTTP],
      streamableHttp: { statelessMode: true, enableJsonResponse: true },
      guards: [JwtGuard],
    }),

    // Auth (optional — for built-in OAuth IdP)
    // McpAuthModule.forRoot({ ... }),

    // Rate limiting
    ThrottlerModule.forRootAsync({ ... }),

    // Health checks
    TerminusModule,
  ],
})
export class AppModule {}
```

---

## DI Wiring Rules

- Tool providers are `@Injectable()` classes with `@Tool()` methods — register in the module that imports `McpModule`.
- Guards passed to `McpModule.forRoot({ guards })` run on every MCP endpoint automatically.
- Interceptors for audit logging should be registered as `APP_INTERCEPTOR` in `AppModule`.
- `ExceptionFilter` for MCP error mapping: register as `APP_FILTER`.

---

## Environment Schema (Zod)

```ts
// src/config/env.schema.ts
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  MCP_SERVER_URL: z.string().url(),
  MCP_RESOURCE_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  REDIS_URL: z.string().url(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace','debug','info','warn','error']).default('info'),
});

export const validateEnv = (config: Record<string, unknown>) =>
  EnvSchema.parse(config);
```

Fail-fast on missing required vars: `ConfigModule.forRoot({ validate: validateEnv })` throws at bootstrap before the server accepts connections.

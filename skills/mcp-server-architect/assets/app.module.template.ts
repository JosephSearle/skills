// Targets: @rekog/mcp-nest ^1.0.0, @nestjs/common ^10.x
// Replace all <PLACEHOLDER> values before use.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import Redis from 'ioredis';
import { McpModule, STREAMABLE_HTTP } from '@rekog/mcp-nest';

import { validateEnv } from './config/env.schema';
import { JwtGuard } from './mcp/guards/jwt.guard';
import { AuditInterceptor } from './mcp/interceptors/audit.interceptor';
import { McpExceptionFilter } from './mcp/filters/mcp-exception.filter';
import { HealthController } from './health/health.controller';
import { PerTokenThrottlerGuard } from './mcp/guards/per-token-throttler.guard';

// Tool / resource / prompt providers
import { <YourToolProvider> } from './mcp/tools/<your-tool>.tool';

@Module({
  imports: [
    // 1. Config — validates env vars at startup via Zod; fail-fast on missing required
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // 2. Structured logging — must load before McpModule for pino context propagation
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.token',
            '*.secret',
            '*.access_token',
            '*.refresh_token',
            '*.api_key',
          ],
          remove: true,
        },
      },
    }),

    // 3. MCP core
    McpModule.forRoot({
      name: process.env.MCP_SERVER_NAME ?? '<server-name>',
      version: '1.0.0',
      transport: [STREAMABLE_HTTP],
      streamableHttp: {
        statelessMode: true,         // change to false if you need sampling/elicitation
        enableJsonResponse: true,    // WAF-friendly; set false when using SSE progress
      },
      guards: [JwtGuard],
      capabilities: {
        tools: { listChanged: false },
        // Uncomment as needed:
        // resources: { listChanged: false, subscribe: false },
        // prompts:   { listChanged: false },
        // logging:   {},
      },
    }),

    // 4. Redis-backed rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [
          { name: 'ip',    ttl: 60_000, limit: 100   },
          { name: 'token', ttl: 60_000, limit: 1_000 },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(cfg.getOrThrow('REDIS_URL')),
        ),
      }),
    }),

    // 5. Health checks
    TerminusModule,
  ],

  controllers: [
    HealthController,
  ],

  providers: [
    // Tool / resource / prompt providers
    <YourToolProvider>,

    // Global guards (order matters: throttler before JWT)
    { provide: APP_GUARD,       useClass: PerTokenThrottlerGuard },

    // Global audit interceptor
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    // Global MCP exception filter
    { provide: APP_FILTER,      useClass: McpExceptionFilter },
  ],
})
export class AppModule {}

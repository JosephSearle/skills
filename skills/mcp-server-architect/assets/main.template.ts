// Targets: @rekog/mcp-nest ^1.0.0, @nestjs/core ^10.x
// IMPORTANT: tracing.ts MUST be the first import — before NestFactory and any instrumented modules.

import './observability/tracing';  // OTel patches Node.js internals at import time

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Buffer logs until pino logger replaces the default
    bufferLogs: true,
  });

  // Replace NestJS default logger with pino (must happen after create)
  app.useLogger(app.get(Logger));

  // Global validation pipe for non-tool DTOs (OAuth callbacks, admin endpoints)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip undeclared properties
      forbidNonWhitelisted: true, // reject requests with extra properties
      transform: true,            // coerce query strings to declared types
    }),
  );

  // Graceful shutdown — drains in-flight requests before closing pools
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`MCP server listening on port ${port}`, 'Bootstrap');
}

bootstrap();

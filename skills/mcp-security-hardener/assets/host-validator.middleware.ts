// Targets: @nestjs/common ^10.x
// DNS rebinding defence: validates Host and Origin headers against an allowlist.
// Copy to: src/mcp/middleware/host-validator.middleware.ts
// Register in AppModule.configure() for the '/mcp' route.

import { Injectable, NestMiddleware, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HostValidatorMiddleware implements NestMiddleware {
  private readonly allowedHosts: string[];
  private readonly allowedOrigins: string[];

  constructor() {
    // Load allowlists from environment at construction time
    this.allowedHosts = (process.env.CORS_ALLOWED_HOSTS ?? '')
      .split(',').map(h => h.trim()).filter(Boolean);
    this.allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',').map(o => o.trim()).filter(Boolean);
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const host   = req.headers['host'];
    const origin = req.headers['origin'];

    // Host header validation — present in all HTTP/1.1+ requests
    if (host && this.allowedHosts.length > 0) {
      const hostWithoutPort = host.split(':')[0];
      if (!this.allowedHosts.some(h => hostWithoutPort === h || host === h)) {
        throw new BadRequestException(`Host header '${host}' is not in the allowlist`);
      }
    }

    // Origin header validation — sent by browsers on cross-origin requests
    if (origin && this.allowedOrigins.length > 0) {
      if (!this.allowedOrigins.includes(origin)) {
        throw new ForbiddenException(`Origin '${origin}' is not in the allowlist`);
      }
    }

    next();
  }
}

// ─── Registration in AppModule ──────────────────────────────────────────────
// import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
// import { HostValidatorMiddleware } from './mcp/middleware/host-validator.middleware';
//
// @Module({ ... })
// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer
//       .apply(HostValidatorMiddleware)
//       .forRoutes('/mcp');
//   }
// }

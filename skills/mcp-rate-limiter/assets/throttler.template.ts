// Targets: @nestjs/throttler ^5.x, @nest-lab/throttler-storage-redis ^5.x, ioredis ^5.x
// Copy ThrottlerModule config into AppModule.imports
// Copy PerTokenThrottlerGuard into src/mcp/guards/per-token-throttler.guard.ts

import { Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { Request } from 'express';

// ─── ThrottlerModule config (add to AppModule.imports) ─────────────────────
export const ThrottlerModuleConfig = ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => {
    const redisUrl = cfg.get<string>('REDIS_URL');

    return {
      throttlers: [
        // Per-IP throttler: blocks unauthenticated abuse and DoS
        { name: 'ip',    ttl: 60_000, limit: 100   },
        // Per-token throttler: limits authenticated users
        { name: 'token', ttl: 60_000, limit: 1_000 },
      ],
      // Redis storage required for multi-instance deployments
      // Remove if running single-instance (development only)
      ...(redisUrl
        ? {
            storage: new ThrottlerStorageRedisService(
              new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                enableOfflineQueue: false,
              }),
            ),
          }
        : {}),
    };
  },
});

// ─── PerTokenThrottlerGuard ─────────────────────────────────────────────────
// Override getTracker to key by JWT sub claim for authenticated requests.
// Register as: { provide: APP_GUARD, useClass: PerTokenThrottlerGuard }

@Injectable()
export class PerTokenThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Use JWT subject (populated by JwtGuard) for authenticated requests
    // Fall back to IP address for unauthenticated requests
    const user = (req as any).user as { sub?: string } | undefined;
    return user?.sub ?? req.ip ?? 'anonymous';
  }

  // Optional: customise the 429 response body
  // protected async throwThrottlingException(
  //   context: ExecutionContext,
  //   throttlerLimitDetail: ThrottlerLimitDetail,
  // ): Promise<void> {
  //   const res = context.switchToHttp().getResponse();
  //   res.status(429).json({
  //     statusCode: 429,
  //     error: 'Too Many Requests',
  //     retryAfter: throttlerLimitDetail.timeToExpire,
  //   });
  // }
}

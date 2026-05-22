# Redis Storage Reference

## Why Redis is Required for Multi-Instance Deployments

`@nestjs/throttler`'s default storage is in-process memory. In a multi-instance deployment (Kubernetes pods, ECS tasks, auto-scaling groups), each replica has its own counter. A client can hit N replicas and exceed the limit N times before any single replica triggers a 429.

Redis provides a single shared counter store across all replicas.

## Installation

```bash
npm install @nest-lab/throttler-storage-redis ioredis
```

## Configuration

```ts
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

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
})
```

## Redis Connection Resilience

ioredis reconnects automatically on connection loss. Configure retry behaviour:

```ts
new Redis(cfg.getOrThrow('REDIS_URL'), {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,  // fail fast rather than queue indefinitely
  lazyConnect: false,         // connect eagerly at startup so /readyz can detect failure
})
```

Add a readiness probe that checks Redis connectivity:

```ts
// In HealthController readyz endpoint
@Get('readyz')
@HealthCheck()
async readiness() {
  return this.health.check([
    () => this.redis.checkHealth('redis'),
  ]);
}
```

## Redis Key Pattern

`@nest-lab/throttler-storage-redis` stores counters with the pattern:
```
throttler:<throttler-name>:<tracker-key>
```

Example: `throttler:token:user123` — TTL matches the configured window.

## Single-Instance Alternative (Development)

For local development without Redis:

```ts
ThrottlerModule.forRoot({
  throttlers: [
    { name: 'ip', ttl: 60_000, limit: 100 },
  ],
  // No storage: key — defaults to in-memory
})
```

Use `NODE_ENV` or a feature flag to switch between in-memory (dev) and Redis (prod):

```ts
useFactory: (cfg: ConfigService) => {
  const redisUrl = cfg.get('REDIS_URL');
  return {
    throttlers: [
      { name: 'ip',    ttl: 60_000, limit: 100   },
      { name: 'token', ttl: 60_000, limit: 1_000 },
    ],
    ...(redisUrl ? { storage: new ThrottlerStorageRedisService(new Redis(redisUrl)) } : {}),
  };
}
```

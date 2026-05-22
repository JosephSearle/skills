# Health Endpoints Reference

## Liveness vs Readiness

| Endpoint | Probe type | What it checks | Fail action |
|----------|------------|----------------|-------------|
| `/healthz` | Liveness | Is the process alive? (no external checks) | K8s restarts the pod |
| `/readyz` | Readiness | Can the server serve traffic? (checks Redis, DB, auth) | K8s stops sending traffic to this pod |

**Critical rule:** `/healthz` MUST return 200 even if Redis is down. If liveness fails due to Redis, K8s will restart the pod in a loop — Redis being down is a readiness failure, not a liveness failure.

## Terminus Setup

```bash
npm install @nestjs/terminus
```

```ts
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '@nestjs/passport';  // or equivalent skip-auth decorator

@SkipThrottle()   // never rate-limit health endpoints
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('healthz')
  @Public()        // no JWT required — load balancer calls this
  @HealthCheck()
  liveness() {
    // No external checks — if this runs, the process is alive
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),  // 512 MB
    ]);
  }

  @Get('readyz')
  @Public()
  @HealthCheck()
  readiness() {
    return this.health.check([
      // Redis connectivity
      () => this.http.pingCheck('redis', `${process.env.REDIS_URL}/ping`),
      // Auth server metadata reachable
      () => this.http.pingCheck(
        'auth-server',
        `${process.env.JWT_ISSUER}/.well-known/openid-configuration`,
      ),
    ]);
  }
}
```

## Guard Exclusion

Health endpoints MUST be accessible without authentication. Two approaches:

**Option A — @Public() decorator** (if using `@nestjs/passport`):
```ts
@Public()
@Get('healthz')
```

**Option B — Guard allowlist** (if using custom guards):
```ts
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (req.path === '/healthz' || req.path === '/readyz') return true;
    return super.canActivate(ctx);
  }
}
```

## K8s Probe Configuration

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 2
```

`initialDelaySeconds` should be at least as long as the application startup time.

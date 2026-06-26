# Health Checks with @nestjs/terminus

**Authority:** docs.nestjs.com/recipes/terminus

---

## Install

```bash
npm install @nestjs/terminus
```

---

## Module Setup

```typescript
// health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TerminusModule,
    HttpModule, // required for HttpHealthIndicator
  ],
  controllers: [HealthController],
})
export class HealthModule {}
```

---

## Liveness vs Readiness

| Endpoint | Purpose | Returns 503 when | Used by |
|----------|---------|-----------------|---------|
| `/health/live` | Process is up and responsive | App is frozen/crashed | Kubernetes `livenessProbe` |
| `/health/ready` | Dependencies (DB, Redis) are reachable | DB unreachable, Redis down | Kubernetes `readinessProbe`, load balancer |

Readiness returning `503` is the signal to the load balancer to stop routing traffic to this instance. This is the mechanism for zero-downtime deploys: the new instance isn't marked ready until its readiness probe passes, and the old instance stays in the load balancer rotation until it receives SIGTERM.

```typescript
// health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HttpHealthIndicator, PrismaHealthIndicator } from '@nestjs/terminus';
import { VERSION_NEUTRAL, Version } from '@nestjs/common';

@Controller('health')
@Version(VERSION_NEUTRAL) // health checks must be accessible without version prefix
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator, // or TypeOrmHealthIndicator, MikroOrmHealthIndicator
  ) {}

  // Liveness: is the process alive?
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]); // empty check — if we respond, we're alive
  }

  // Readiness: can we serve traffic?
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      // DB health check
      () => this.db.pingCheck('database'),
    ]);
  }
}
```

### TypeORM Health Indicator

```typescript
import { TypeOrmHealthIndicator } from '@nestjs/terminus';

// In health.module.ts — import TypeOrmModule.forFeature([]) for the indicator
() => this.db.pingCheck('database', { timeout: 3000 })
```

### MikroORM Health Indicator

```typescript
import { MikroOrmHealthIndicator } from '@nestjs/terminus';
// (included in @nestjs/terminus >= 10)
() => this.db.pingCheck('database')
```

---

## Kubernetes Probe Configuration

```yaml
# kubernetes deployment.yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

---

## enableShutdownHooks() Dependency

`@nestjs/terminus` health checks depend on the NestJS shutdown hooks to gracefully close connections. Call `app.enableShutdownHooks()` in `main.ts` before `app.listen()`.

Without `enableShutdownHooks()`, the app receives SIGTERM but doesn't cleanly close DB connections — the health check may return `200` briefly after the app is shutting down, causing brief traffic to a dying instance.

→ See `apicraft-devops` for the full graceful shutdown setup.

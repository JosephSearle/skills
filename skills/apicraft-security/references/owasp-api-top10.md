# OWASP API Security Top 10 (2023) — NestJS Countermeasures

**Authority:** owasp.org/API-Security/editions/2023/en/0x11-t10/

---

## Top 10 Table

| # | Risk | NestJS Countermeasure | Skill ref |
|---|------|----------------------|-----------|
| API1 | Broken Object Level Authorization (BOLA) | Per-record ownership check in service layer | `apicraft-security` §authorization.md |
| API2 | Broken Authentication | `@nestjs/jwt` + Passport, rotating refresh tokens, HttpOnly cookies | `apicraft-security` §authentication.md |
| API3 | Broken Object Property Level Authorization | `ValidationPipe` whitelist + Response DTOs + `@Exclude()` | `apicraft-validation` |
| API4 | Unrestricted Resource Consumption | `@nestjs/throttler` with Redis storage for distributed deployments | below |
| API5 | Broken Function Level Authorization | `@Roles()` decorator + `RolesGuard` + CASL for complex permissions | `apicraft-security` §authorization.md |
| API6 | Unrestricted Business Flow Access | Business-logic guards, CAPTCHA on sensitive flows | below |
| API7 | Server-Side Request Forgery (SSRF) | URL allowlisting; block RFC1918/169.254.x.x in HTTP client config | below |
| API8 | Security Misconfiguration | Helmet, strict CORS, disable stack traces in production | below |
| API9 | Improper Inventory Management | URI versioning, retire old versions, restrict Swagger in production | `apicraft-documentation` |
| API10 | Unsafe Consumption of APIs | Validate/sanitize all third-party responses with Zod/class-validator | below |

> ⚠️ **Caveat on statistics:** The "BOLA = 40% of API attacks" figure is contested. Wallarm's 2026 analysis attributes 52% of 2025 incidents to broken authentication. Both risks are critical regardless of the exact percentage — treat them as co-equal priorities.

---

## API4 — Rate Limiting with Redis

The default `ThrottlerModule` stores counters in process memory — ineffective in multi-instance deployments:

```bash
npm install @nestjs/throttler @nestjs-throttler-storage-redis ioredis
```

```typescript
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nestjs-throttler-storage-redis';

ThrottlerModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    storage: new ThrottlerStorageRedisService(configService.get('REDIS_URL')),
    throttlers: [
      { name: 'burst', ttl: 1000, limit: 20 },
      { name: 'sustained', ttl: 60000, limit: 200 },
    ],
  }),
  inject: [ConfigService],
}),
```

Skip throttling on health check endpoints:

```typescript
@SkipThrottle()
@Get('/health')
health() { ... }
```

---

## API6 — Unrestricted Business Flow Access

Protect flows that should only execute once or at controlled rates:

```typescript
// Custom guard for idempotency check
@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['idempotency-key'] as string | undefined;
    if (!key) return true;

    const exists = await this.redis.get(`idempotency:${key}`);
    if (exists) {
      throw new ConflictException('Duplicate request — idempotency key already used');
    }
    return true;
  }
}
```

---

## API7 — SSRF Prevention

```typescript
import { URL } from 'url';

function isSafeUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  // Block private/loopback ranges
  const BLOCKED_PATTERNS = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,  // link-local (cloud metadata endpoints)
    /^::1$/,        // IPv6 loopback
    /^localhost$/i,
  ];

  const hostname = url.hostname;
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new ForbiddenException('SSRF: URL targets a private network address');
  }

  return true;
}
```

---

## API8 — Security Misconfiguration

```typescript
// main.ts — apply Helmet globally
import helmet from 'helmet';

app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // disable if serving assets to other origins
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
);

// Strict CORS — never use origin: '*' for APIs with authentication
app.enableCors({
  origin: configService.get<string[]>('CORS_ORIGINS'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});
```

Never expose stack traces in production — handled by the global exception filter. See `apicraft-error-handling`.

---

## API10 — Unsafe Consumption of APIs

Validate all data received from third-party APIs:

```typescript
import { z } from 'zod';

const ExternalUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().max(200),
});

async function fetchExternalUser(id: string): Promise<ExternalUser> {
  const response = await fetch(`https://api.external.com/users/${id}`);
  const raw = await response.json();

  const result = ExternalUserSchema.safeParse(raw);
  if (!result.success) {
    throw new InfrastructureException('External API returned unexpected shape');
  }
  return result.data;
}
```

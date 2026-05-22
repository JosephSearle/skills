---
name: mcp-rate-limiter
description: >
  Configures and audits rate limiting for NestJS MCP servers: dual fixed-window throttling
  (per-IP for unauthenticated abuse and per-token for authenticated abuse), Redis-backed storage
  for multi-instance deployments, IETF RateLimit response headers, and path exclusions for
  infrastructure endpoints. Use when the user asks about "rate limit MCP", "per-token rate limit",
  "429 response", "Redis throttler for MCP", "@nestjs/throttler", "throttle per user", or
  multi-instance rate limiting. Do NOT use for authentication (→ mcp-auth-guardian),
  security hardening (→ mcp-security-hardener), or observability (→ mcp-observability).
---

# MCP Rate Limiter

Configures dual-throttler rate limiting for NestJS MCP servers. Targets `@nestjs/throttler` ^5.x
and `@nest-lab/throttler-storage-redis` ^5.x.

---

## Mode: GENERATE

Use when the user wants to add rate limiting to a server.

### GENERATE Checklist

- [ ] Step 1 — Determine deployment topology (single instance vs multi-instance)
- [ ] Step 2 — Configure dual throttler (per-IP + per-token)
- [ ] Step 3 — Implement custom tracker guard
- [ ] Step 4 — Exclude infrastructure paths
- [ ] Step 5 — Verify RateLimit headers are returned on 429
- [ ] Step 6 — Emit `assets/throttler.template.ts`

---

### Step 1 — Deployment topology

```
Single instance (development, single-container)?
  └─ In-memory ThrottlerStorage (default) — no Redis required
  └─ WARNING: in-memory does not survive restarts; do not use in production

Multi-instance (Kubernetes, ECS, any load-balanced deployment)?
  └─ Redis-backed ThrottlerStorageRedisService — REQUIRED
  └─ In-memory throttler silently fails load balancing: each replica has its own counter,
     so a client can exceed the limit by factor N (number of replicas) before being blocked
```

---

### Step 2 — Dual throttler configuration

Two throttlers run in sequence on every request:

| Throttler | Key | Limit | TTL | Purpose |
|-----------|-----|-------|-----|---------|
| `ip` | Client IP address | 100 req | 60 s | Block unauthenticated abuse / DoS from a single IP |
| `token` | JWT `sub` claim | 1 000 req | 60 s | Block authenticated abuse from a single user |

```ts
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

Tune limits based on observed traffic patterns; these are reasonable starting defaults.

> Load `references/dual-throttler.md` for a detailed explanation of the strategy.

---

### Step 3 — Custom tracker guard

The default `ThrottlerGuard` tracks by IP address only. Override `getTracker()` to use the JWT `sub` claim for authenticated requests:

```ts
@Injectable()
export class PerTokenThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Prefer user identity (set by JWT guard) over IP
    const sub = (req as any).user?.sub;
    return sub ?? req.ip ?? 'anonymous';
  }
}
```

Register as `APP_GUARD` in `AppModule.providers` — after the JWT guard so `request.user` is populated.

> Load `references/dual-throttler.md` for guard ordering and multiple-throttler interaction.

---

### Step 4 — Exclude infrastructure paths

Infrastructure endpoints must never be rate-limited — they are called by load balancers and monitoring systems at high frequency:

```ts
// In health controller
@SkipThrottle()
@Controller()
export class HealthController {
  @Get('healthz') liveness() { ... }
  @Get('readyz')  readiness() { ... }
}

// In PRM metadata controller
@SkipThrottle()
@Controller('.well-known')
export class PrmMetadataController { ... }
```

Also exclude `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.

---

### Step 5 — RateLimit headers

`@nestjs/throttler` automatically adds `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Ensure `429` responses include a `Retry-After` header:

```ts
// Throttler guard adds this automatically. Verify in integration tests:
// expect(response.headers['retry-after']).toBeDefined();
// expect(response.headers['x-ratelimit-remaining']).toBe('0');
```

IETF draft RateLimit header names (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Policy`, `RateLimit-Reset`) are preferred over the non-standard `X-` prefix variants; `@nestjs/throttler` ≥5.x supports both.

> Load `references/rate-limit-headers.md` for the IETF header spec and 429 response body structure.

---

### GENERATE Examples

**Example 1 — Add rate limiting to a multi-instance server**
User: "Add rate limiting to my MCP server running on Kubernetes."
1. Topology: multi-instance → Redis required.
2. Configure `ThrottlerModule.forRootAsync` with Redis storage.
3. Implement `PerTokenThrottlerGuard` (tracker = `req.user.sub ?? req.ip`).
4. Add `@SkipThrottle()` to `HealthController` and `PrmMetadataController`.
5. Emit `assets/throttler.template.ts`.

**Example 2 — Rate limit by user, not IP**
User: "I want each authenticated user limited to 500 requests per minute."
1. Single throttler: `{ name: 'token', ttl: 60_000, limit: 500 }`.
2. `getTracker` returns `req.user.sub` — throws if not authenticated.
3. Keep IP throttler as a secondary guard for unauthenticated probes.

---

## Mode: AUDIT

Use when reviewing the rate limiting configuration of an existing server.

### AUDIT Checklist

- [ ] Step 1 — Run `scripts/audit-rate-limiter.ts` against the source directory
- [ ] Step 2 — Map each JSON finding to severity
- [ ] Step 3 — Produce Markdown report with file:line citations
- [ ] Step 4 — Check Redis URL is in the env schema

### AUDIT Findings Table

| Code | Severity | Description |
|------|----------|-------------|
| R001 | HIGH | In-memory throttler storage in a deployment with >1 replica |
| R002 | MEDIUM | `/healthz` or `/readyz` not decorated with `@SkipThrottle()` |
| R003 | HIGH | No per-token tracker — all requests bucketed by IP only |
| R004 | MEDIUM | `429` responses missing `Retry-After` or `RateLimit-*` headers |
| R005 | HIGH | `REDIS_URL` absent from Zod env schema — missing var fails silently |

### AUDIT Examples

**Example 3 — Audit throttler config**
User: "Audit my rate limiting setup."
1. Run: `npx ts-node scripts/audit-rate-limiter.ts src/`
2. Check R001 first — in-memory in multi-instance is a silent failure mode.
3. Verify Redis connectivity in integration tests.

**Example 4 — Check health endpoint exclusion**
User: "My health checks are being throttled."
1. Grep for `@SkipThrottle()` on `HealthController`.
2. Flag R002 if missing.
3. Fix: add `@SkipThrottle()` to the controller class, not just the method.

---

## References

- `references/dual-throttler.md` — per-IP vs per-token strategy, TTL/limit settings, custom tracker
- `references/redis-storage.md` — ThrottlerStorageRedisService setup, connection resilience
- `references/rate-limit-headers.md` — IETF RateLimit-* headers, Retry-After, 429 body structure

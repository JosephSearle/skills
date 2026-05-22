# Dual Throttler Strategy Reference

## Why Two Throttlers

A single IP-based throttler is insufficient for MCP servers because:
- **IP throttling alone** does not protect against authenticated users making thousands of calls from a single account (hitting your LLM budget, database, or downstream APIs).
- **Token throttling alone** does not protect against unauthenticated probes from botnets or scanners that never present a token.

The dual strategy addresses both:
1. `ip` throttler — blocks DoS and unauthenticated abuse at the network level.
2. `token` throttler — limits per-user call rate for authenticated requests.

## Reference Settings

| Throttler | Key | Default Limit | Default TTL | Rationale |
|-----------|-----|:---:|:---:|-----------|
| `ip` | Client IP (`req.ip`) | 100 req | 60 s | Enough for legitimate bursts; blocks port-scanners and simple DoS |
| `token` | JWT `sub` (`req.user.sub`) | 1 000 req | 60 s | 10x the IP limit; power users can do more, but no single account can overwhelm the server |

Tune these to your observed traffic; these are conservative starting defaults for a new deployment.

## Throttler Interaction

When both throttlers are configured, `@nestjs/throttler` runs them in order. A request is rejected if it exceeds **either** limit. The response includes headers for the most-restrictive triggered throttler.

```
Request arrives
  ├─ ip throttler: check IP → allow (95/100 used) or 429
  └─ token throttler: check sub → allow (490/1000 used) or 429
```

A unauthenticated request (no JWT) falls back to the IP bucket only. `getTracker` must handle this:

```ts
protected async getTracker(req: Request): Promise<string> {
  const sub = (req as any).user?.sub;  // populated by JwtGuard
  return sub ?? req.ip ?? 'anonymous';
}
```

## Guard Ordering

The `PerTokenThrottlerGuard` must run **after** the JWT guard so `req.user` is populated:

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtGuard },             // 1. Authenticate
  { provide: APP_GUARD, useClass: PerTokenThrottlerGuard }, // 2. Rate limit
]
```

Or: pass `JwtGuard` to `McpModule.forRoot({ guards: [JwtGuard] })` and register the throttler guard globally with `APP_GUARD`.

## Skipping Throttle for Specific Routes

```ts
@SkipThrottle()                   // skip all throttlers
@SkipThrottle({ ip: true })       // skip ip throttler only
@SkipThrottle({ token: true })    // skip token throttler only
```

Apply to controller class (affects all methods) or individual methods.

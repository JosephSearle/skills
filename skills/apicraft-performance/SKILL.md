---
name: apicraft-performance
description: >
  Performance patterns for NestJS APIs: Redis caching with @nestjs/cache-manager v6
  (Keyv-based), DB connection pool tuning, response compression, the Fastify adapter
  decision (only switch when load testing proves the framework is the bottleneck),
  lazy-loading modules, streaming large responses with StreamableFile, and background
  jobs with @nestjs/bullmq including graceful shutdown. Requires apicraft-context
  to be loaded first.
  Triggers on: "performance", "caching", "Redis", "Fastify", "BullMQ", "background jobs",
  "queue", "slow API", "response time", "pool", "connection pool", "cache-manager",
  "StreamableFile", "lazy module", "LazyModuleLoader".
  Not for observability/metrics — use apicraft-observability.
version: 1.0.0
---

## Core Philosophy

Most NestJS performance problems are DB problems, not framework problems. Before switching to Fastify, adding a cache layer, or tuning connection pools, profile the actual bottleneck. A 2–3x Fastify throughput gain is meaningless if the request spends 95% of its time waiting for a database query. The performance toolbox in this skill addresses real bottlenecks in priority order: DB connection pooling first, then caching, then streaming, then job offloading.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Caching API responses → load references/caching.md
  ├─ Redis cache setup → load references/caching.md §Redis store
  ├─ Slow queries / connection pool → load references/caching.md §Connection pool tuning
  ├─ Should we use Fastify? → load references/caching.md §Fastify adapter decision
  ├─ Background job processing → load references/background-jobs.md
  └─ Large file streaming → load references/caching.md §Streaming
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Caching, connection pools, Fastify decision, compression, streaming | `references/caching.md` |
| BullMQ queue setup, worker graceful shutdown | `references/background-jobs.md` |

## Step 3 — Execute

### Performance diagnosis before optimization

```
1. Profile with load testing (k6 or Artillery) — establish baseline
2. Check DB query time (slow query log or EXPLAIN ANALYZE)
   └─ If DB > 80% of response time → DB optimization first (indexes, N+1 fix, pool tuning)
3. Check framework overhead (compare with/without business logic)
   └─ If framework > 20% of response time → consider Fastify
4. Check hot GET endpoints for caching opportunities
5. Check CPU-bound operations for job queue offloading
```

> 💡 **Senior insight:** "Use Fastify for better performance" is often cargo-cult advice. Fastify is 2–3x faster than Express on raw throughput benchmarks, but for most CRUD APIs the bottleneck is the database — not the HTTP framework. Benchmark first with `k6` or `autocannon`. Only switch adapters if the profiler shows framework overhead is the constraint.

> ⚠️ **Caveat:** The 2–3x Fastify throughput figure varies significantly by workload and hardware. Some JSON-heavy endpoints show large gains; DB-bound endpoints show minimal difference.

→ See `references/caching.md` for Redis caching and connection pool tuning.
→ See `references/background-jobs.md` for BullMQ queue setup.

## Step 4 — Validate

- [ ] `CacheInterceptor` or manual `cacheManager.get/set` applied to cacheable GET endpoints
- [ ] Redis store configured (not in-memory store) for multi-instance deployments
- [ ] DB connection pool size tuned per instance count
- [ ] Response compression middleware applied
- [ ] Fastify adapter only adopted after load testing proves it's the bottleneck
- [ ] BullMQ workers handle SIGTERM gracefully via `onModuleDestroy`

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/caching.md` | Redis caching, connection pools, Fastify, compression, streaming | Performance optimization |
| `references/background-jobs.md` | BullMQ queue, workers, graceful shutdown | Background job processing |

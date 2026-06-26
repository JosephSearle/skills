# Graceful Shutdown and DB Migrations

**Authority:** docs.nestjs.com/fundamentals/lifecycle-events

---

## enableShutdownHooks()

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Required for lifecycle hooks (onModuleDestroy, onApplicationShutdown, etc.)
  app.enableShutdownHooks();

  await app.listen(3000);
}
```

`enableShutdownHooks()` is disabled by default because in some environments (e.g., certain cloud platforms) registering signal handlers interferes with the runtime. Always enable it explicitly.

---

## NestJS v11 Shutdown Hook Order

> ⚠️ **v11 change:** The termination hook order was reversed from v10. The new order is:

```
SIGTERM received
    │
    ▼
onModuleDestroy()          ← providers clean up (close DB connections, stop queues)
    │
    ▼
beforeApplicationShutdown()  ← app-level cleanup before app shuts down
    │
    ▼
onApplicationShutdown()    ← app is about to close; final cleanup
    │
    ▼
process.exit()
```

In v10 it was the reverse. If you're migrating from v10, check your lifecycle hooks.

---

## The PID 1 Problem

> ⚠️ **Gotcha:** Node.js running as PID 1 in a Docker container doesn't receive the OS default signal handlers. SIGTERM — sent by `docker stop` and Kubernetes pod termination — is silently ignored. Docker waits 30 seconds (the default `terminationGracePeriodSeconds`), then sends SIGKILL. The process is force-killed.

**Two solutions:**

```dockerfile
# Solution 1: Tini in the Dockerfile (preferred — embedded in the image)
FROM node:20-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]

# Solution 2: docker run --init (per-run flag, not embedded)
docker run --init my-api
```

Tini (`/sbin/tini`) runs as PID 1, forwards signals to Node (PID 2), and reaps zombie processes.

---

## Handling In-Flight Requests During Shutdown

When SIGTERM arrives, Node starts shutting down — but existing HTTP connections (especially keep-alive connections) may still be serving requests. `nestjs-graceful-shutdown` (using `http-terminator`) closes keep-alive connections cleanly:

```bash
npm install nestjs-graceful-shutdown
```

> ⚠️ **Caveat:** `nestjs-graceful-shutdown` is a community package — vet its maintenance status before adopting.

```typescript
// app.module.ts
import { GracefulShutdownModule } from 'nestjs-graceful-shutdown';

@Module({
  imports: [
    GracefulShutdownModule.forRoot({
      cleanup: async (app) => {
        // Optional: flush logs, close external connections
        await app.get(PrismaService).$disconnect();
      },
      gracefulShutdownTimeout: 10_000, // 10 seconds before force close
    }),
  ],
})
export class AppModule {}
```

---

## DB Migration Strategy

| Command | Use case | What it does |
|---------|----------|--------------|
| `prisma migrate dev` | Local development only | Creates migration, applies it, regenerates client |
| `prisma migrate deploy` | CI/CD and production | Applies pending migrations; does NOT create or regenerate |
| `typeorm migration:run` | CI/CD with TypeORM | Applies pending TypeORM migrations |

### Run migrations as a discrete CI/CD step BEFORE the app starts

```yaml
# GitHub Actions / Kubernetes job — runs before the rolling deploy
steps:
  - name: Run DB migrations
    run: |
      # Prisma
      npx prisma migrate deploy

      # TypeORM
      # npx typeorm migration:run -d dist/data-source.js

    env:
      DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

> ⚠️ **Critical:** Never run `prisma migrate dev` in CI/CD. It detects schema drift, creates a new migration from that drift, and applies it — which can destructively alter your production database.

Running migrations before the app starts ensures the new schema is in place before any code that depends on it receives traffic.

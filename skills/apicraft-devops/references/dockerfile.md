# Multi-Stage Dockerfile and Docker Compose

**Authority:** docs.docker.com/build/building/multi-stage

---

## Production Multi-Stage Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage — lean image with only production artifacts
FROM node:20-alpine AS runner

# Install Tini — fixes PID 1 signal handling (SIGTERM forwarding)
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/package.json ./package.json

# Prisma: copy schema + generated client if using Prisma
# COPY --from=builder --chown=nestjs:nestjs /app/prisma ./prisma

# Run as non-root
USER nestjs

# Expose port (documentation only — actual port set at runtime)
EXPOSE 3000

# Tini as entrypoint — correctly forwards signals to Node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
```

### Key decisions in the Dockerfile

| Decision | Rationale |
|----------|-----------|
| `node:20-alpine` | Alpine is ~50MB vs ~1GB for full Debian; Node 20 is the minimum for NestJS 11 |
| Multi-stage build | Build tools (TypeScript, devDeps) not in the final image |
| `npm ci` not `npm install` | Reproducible installs from lockfile |
| Non-root user | Limits container blast radius; required by many cluster security policies |
| Tini as entrypoint | Forwards signals to PID 2 (Node) correctly; reaps zombie processes |
| `--chown=nestjs:nestjs` | Files owned by non-root user from the start |

---

## .dockerignore

```
node_modules
dist
.git
.env*
coverage
*.md
.eslintrc*
.prettierrc*
biome.json
vitest.config.ts
*.spec.ts
__tests__
```

---

## Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.9'

services:
  api:
    build:
      context: .
      target: builder  # use builder stage for dev (hot reload)
    command: npm run start:dev
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/mydb
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules  # prevent host node_modules from overwriting container
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mydb
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## Building and Running

```bash
# Build for production
docker build -t my-api:latest .

# Run with Tini (--init uses Docker's built-in init)
docker run --init -p 3000:3000 --env-file .env my-api:latest

# Or use Docker Compose for the full stack
docker-compose up --build
```

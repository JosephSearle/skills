# Docker Reference

## Build the LangGraph Server image

```bash
# Build using the LangGraph CLI (recommended — handles dependency installation correctly)
langgraph build -t my-agent:latest

# Tag for a registry
langgraph build -t my-registry.example.com/my-agent:1.0.0

# With build args (e.g., private PyPI)
langgraph build -t my-agent:latest \
  --build-arg PIP_INDEX_URL=https://my-private-pypi.example.com/simple/
```

`langgraph build` wraps `docker build` and handles the uv-based dependency installation from
`langgraph.json` `"dependencies"` correctly. Do not write a custom `Dockerfile` unless you
need non-Python system dependencies.

## Custom Dockerfile (only when needed)

```dockerfile
FROM langchain/langgraphjs-api:latest AS builder
# OR for Python:
FROM python:3.11-slim AS base

# System deps (only when langgraph build is insufficient)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen

COPY src/ ./src/
COPY langgraph.json ./

EXPOSE 8000
CMD ["langgraph", "start", "--port", "8000"]
```

## docker-compose for local development stack

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: langgraph
      POSTGRES_PASSWORD: langgraph
      POSTGRES_DB: langgraph
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U langgraph"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  langgraph:
    build:
      context: .
      dockerfile: Dockerfile   # or use: image: my-agent:latest
    ports:
      - "8000:8000"
    environment:
      POSTGRES_URI: postgresql://langgraph:langgraph@postgres:5432/langgraph
      REDIS_URI: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      MLFLOW_TRACKING_URI: ${MLFLOW_TRACKING_URI:-}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/ok"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  postgres_data:
```

```bash
# Start the local stack
docker compose up -d

# Stream logs
docker compose logs -f langgraph

# Tear down (keep volumes)
docker compose down

# Tear down and delete data
docker compose down -v
```

## Turborepo monorepo deployment

When the agent lives inside a Turborepo monorepo alongside TypeScript packages, use `turbo prune`
to produce a pruned subset of the monorepo (only the agent and its workspace dependencies) before
the Python image build. This avoids copying the entire monorepo into the container and keeps image
layers clean.

```dockerfile
# Stage 1 — prune the monorepo to only the agent package and its workspace deps
FROM node:22-slim AS pruner
WORKDIR /app
RUN npm install -g turbo@latest
COPY . .
RUN turbo prune @repo/agent --docker

# Stage 2 — install Python deps from the pruned lockfile
FROM python:3.12-slim AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/uv.lock ./uv.lock
RUN pip install uv && uv sync --frozen --group ci

# Stage 3 — runtime image (no build tools)
FROM python:3.12-slim AS runner
WORKDIR /app
COPY --from=pruner /app/out/full/ .
COPY --from=installer /app/.venv ./.venv
COPY langgraph.json ./

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["langgraph", "start", "--port", "8000"]
```

`turbo prune @repo/agent --docker` produces `out/json/` (package.json files, pnpm-workspace.yaml)
and `out/full/` (full source of the agent and its transitive workspace deps). The installer stage
syncs only the agent's Python dependencies; the runner stage contains no build tooling. See the
`turborepo-nestjs` skill for the equivalent TypeScript `turbo prune` Dockerfile pattern.

---

## Production Postgres configuration

LangGraph Server creates 4 tables on first boot:
- `checkpoints` — graph state per thread/step
- `checkpoint_blobs` — binary state blobs
- `threads` — thread metadata
- `runs` — run metadata and results

Create a dedicated database and user:
```sql
CREATE DATABASE langgraph;
CREATE USER langgraph_app WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE langgraph TO langgraph_app;
```

Use connection pooling (PgBouncer or RDS Proxy) for high-throughput deployments.

## Health checks

```bash
# Server liveness
curl http://localhost:8000/ok
# → {"ok": true}

# List registered assistants
curl http://localhost:8000/assistants
```

---
name: langgraph-deployment
description: >
  Deploy and operate self-hosted LangGraph Server (the open-source LangGraph Platform). Triggers
  on: langgraph.json, langgraph deploy, langgraph build, langgraph dev, self-hosted LangGraph,
  LangGraph Server, LangGraph Platform, Docker LangGraph, Redis LangGraph, Postgres LangGraph,
  horizontal scaling, thread management, run management, assistant API, RemoteGraph deployment,
  /threads, /runs, /assistants, SSE streaming, LangGraph SDK client, langgraph CLI,
  "deploy agent", "self-host LangGraph", "LangGraph in production", "scale LangGraph".
---

## Core Philosophy

LangGraph Server is the self-hosted runtime for production LangGraph agents. It exposes a REST +
SSE API over your compiled graphs and manages thread/run/checkpoint persistence via Postgres and
streaming via Redis. It replaces LangSmith Cloud deployment entirely — there is no vendor lock-in.

Production topology:

```
┌─────────────────────────────────────────┐
│  LangGraph Server (stateless replicas)  │
│  HTTP/SSE  ← client requests            │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  PostgreSQL          Redis
  (threads, runs,   (pub-sub for
  checkpoints)       SSE streaming)
```

LangGraph Server containers are **stateless** — all state lives in Postgres and Redis. Scale
horizontally by adding replicas behind a load balancer.

---

## Step 1 — Determine Context

| Intent | Signals | Action |
|---|---|---|
| **GREENFIELD** | "deploy my agent", "set up LangGraph Server", "production deployment" | Load all references; emit `langgraph.json` + `docker-compose.yml` |
| **SCALE** | "horizontal scaling", "multiple replicas", "load balancer" | Load `references/scaling.md`; emit replica config |
| **CLIENT** | "call my deployed agent", "LangGraph SDK", "RemoteGraph", "/threads", "/runs" | Load `references/sdk-client.md`; emit client code |
| **DEBUG** | "langgraph dev", "local server", "test deployment" | Load `references/langgraph-json.md` + `references/docker.md` §local dev |

---

## Step 2 — Load References

| Reference file | Load when |
|---|---|
| `references/langgraph-json.md` | Any `langgraph.json` authoring, graph registration, env config, auth |
| `references/docker.md` | Any Dockerfile, docker-compose, local dev stack, container build |
| `references/scaling.md` | Any horizontal scaling, replica config, Redis pub-sub, thread affinity |
| `references/sdk-client.md` | Any LangGraph SDK client, RemoteGraph, thread/run/assistant management |

---

## Step 3 — Apply Patterns

### `langgraph.json` — minimal example

```json
{
  "graphs": {
    "my_agent": "./src/myagent/graph.py:graph"
  },
  "dependencies": ["."],
  "env": ".env"
}
```

The value `"./src/myagent/graph.py:graph"` points to the `CompiledGraph` object exported from that
module. The key (`"my_agent"`) becomes the assistant name in the API.

### Build and run

```bash
# Local dev (hot-reload, no Docker needed)
langgraph dev --port 2024

# Build Docker image
langgraph build -t my-agent:latest

# Production run (with external Postgres + Redis)
docker run -p 8000:8000 \
  -e POSTGRES_URI="postgresql://user:pass@db:5432/langgraph" \
  -e REDIS_URI="redis://redis:6379" \
  my-agent:latest
```

### Infrastructure requirements

| Service | Role | Minimum spec |
|---|---|---|
| Postgres ≥ 14 | Thread/run/checkpoint persistence | 4 tables auto-created on first boot |
| Redis ≥ 7 | Pub-sub for SSE streaming | Single instance or Sentinel |
| LangGraph Server | Stateless API container | ≥ 2 vCPU, 4 GB RAM per replica |

### Which API endpoint for which task?

| Task | Endpoint | Notes |
|---|---|---|
| Create a new conversation thread | `POST /threads` | Returns `thread_id` |
| Run the agent (sync) | `POST /threads/{id}/runs/wait` | Blocks until completion |
| Run the agent (stream) | `POST /threads/{id}/runs/stream` | SSE — use for UI |
| Get thread state | `GET /threads/{id}/state` | Returns last checkpoint |
| List all assistants | `GET /assistants` | Each graph is an assistant |
| Resume after interrupt | `POST /threads/{id}/runs` with `resume` body | HITL continue |

---

## Step 4 — Output & Verification

```bash
# Verify langgraph.json is valid
langgraph dev --port 2024 &

# Smoke test via curl
curl http://localhost:2024/assistants

# Test a run
curl -X POST http://localhost:2024/threads \
  -H "Content-Type: application/json" \
  -d '{}'
# → {"thread_id": "..."}

curl -X POST http://localhost:2024/threads/{thread_id}/runs/wait \
  -H "Content-Type: application/json" \
  -d '{"assistant_id": "my_agent", "input": {"messages": [{"role": "user", "content": "hello"}]}}'
```

---

## Reference Files

| File | Domain |
|---|---|
| [references/langgraph-json.md](references/langgraph-json.md) | Full `langgraph.json` schema, graph registration, env, auth, http config |
| [references/docker.md](references/docker.md) | Dockerfile, docker-compose for local dev stack (Postgres + Redis + Server) |
| [references/scaling.md](references/scaling.md) | Replica patterns, Redis pub-sub, horizontal scale config, load balancer |
| [references/sdk-client.md](references/sdk-client.md) | LangGraph SDK client, RemoteGraph, thread/run/assistant management |

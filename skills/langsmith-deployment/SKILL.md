---
name: langsmith-deployment
description: >
  Deploy, configure, and operate LangGraph agents on LangSmith Deployment (formerly LangGraph
  Platform) in production. Triggers on: langgraph.json, langgraph dev, langgraph build,
  langgraph deploy, langgraph up, LangSmith Deployment, LangGraph Platform, Agent Server,
  Assistant, Thread, Run, Cron, multitask_strategy, stream_mode SSE, RemoteGraph,
  langgraph-sdk, LangGraphClient, AsyncLangGraphClient, BYOC, self-hosted,
  PostgreSQL >=14, Redis >=5, langgraph-cloud Helm, LANGGRAPH_CLOUD_LICENSE_KEY, wolfi,
  N_JOBS_PER_WORKER, agent-chat-ui, create-agent-chat-app.
---

## Core Philosophy

The Agent Server runtime is identical across all four topologies — what changes is only who
manages the infrastructure. Postgres is the durable truth: it owns every assistant, thread,
run, cron, checkpoint, and long-term memory entry; Redis is ephemeral infrastructure that owns
nothing except pub/sub channels and short-lived worker metadata. Scale workers (`N_JOBS_PER_WORKER`,
default 10) for IO-bound graphs; size Postgres generously for write-heavy workloads. Never
deploy the Agent Server into scale-to-zero serverless environments — queued runs will be lost
on cold-start eviction.

---

## Step 1 — Determine Context

Classify the request before loading any references:

| Topology signal | Classification | Plan required |
|---|---|---|
| "deploy to LangSmith", "1-click GitHub", `langgraph deploy`, managed SaaS, US/EU region | **CLOUD** | Plus or above |
| "Docker Compose", "self-hosted lite", no control plane, full CI/CD ownership | **SELF-HOSTED** | Free (node-limited) or license |
| "data must stay in our VPC", "hybrid", SaaS control plane + your data plane | **HYBRID** | Enterprise |
| "air-gap", "full compliance", "Helm on K8s", "BYOC", own cloud | **BYOC** | Enterprise |

Then detect two cross-cutting axes:

1. **Checkpointer** — does the request mention MongoDB? If yes, load `references/topologies.md`
   for the standalone Helm chart (v0.2.6+) and MongoDB checkpointing caveat.
2. **Client type** — does the request involve Python SDK usage, streaming, or `RemoteGraph`?
   If yes, load `references/langgraph-sdk.md`.

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/topologies.md` | Deployment topologies, infra requirements, Helm, Postgres/Redis, license keys | Any topology question; BYOC/Self-Hosted/Hybrid setup; K8s/Helm deployment |
| `references/langgraph-json.md` | `langgraph.json` schema, CLI commands (`dev`/`build`/`up`/`deploy`), image distro | Any project config, CLI usage, Docker build, or `wolfi` image question |
| `references/agent-server-api.md` | REST API — Assistants, Threads, Runs, Crons, Store, Streaming, Webhooks, A2A, MCP | Any API endpoint question; streaming; multitask_strategy; webhook; store |
| `references/langgraph-sdk.md` | Python SDK — `LangGraphClient`, `AsyncLangGraphClient`, `RemoteGraph`, agent-chat-ui | Any Python client code; streaming consumption; `RemoteGraph`; frontend scaffolding |

Load all four references when the request is a full deployment walkthrough or production
readiness review. Load the minimum set for a focused question.

---

## Step 3 — Deploy

### Topology selection gate

```
CLOUD       → 1-click GitHub in LangSmith UI  OR  `langgraph deploy` CLI
              (authenticates via LANGSMITH_API_KEY; provisions Postgres + Redis automatically)

SELF-HOSTED → langgraph build -t IMAGE_TAG
              docker compose up  (Postgres ≥14, Redis ≥5 required; see topologies.md for Compose)

HYBRID      → Self-host data plane only; LangChain manages control plane
              Deploy Agent Server via Helm chart (langchain-ai/helm); configure POSTGRES_URI_CUSTOM
              and REDIS_URI pointing to your managed services

BYOC        → Full Helm install in your VPC:
              helm repo add langchain https://langchain-ai.github.io/helm/
              helm install langgraph-cloud langchain/langgraph-cloud --values config.yaml
              Requires: LANGGRAPH_CLOUD_LICENSE_KEY, egress to beacon.langchain.com
```

### Infra requirements gate (SELF-HOSTED / HYBRID / BYOC)

- Postgres ≥ 14 with `pgvector` extension (checkpoints only: MongoDB available in standalone
  Helm chart v0.2.6+, but Postgres still required for all other data)
- Redis ≥ 5 (pub/sub + ephemeral metadata only — no user or run data stored in Redis)
- `LANGGRAPH_CLOUD_LICENSE_KEY` set at server startup (validated once; offline validation
  requires egress to `https://beacon.langchain.com`)
- Do NOT use Redis Cluster except in Self-Hosted/BYOC deployments
- Multiple deployments may share one Postgres (separate databases) or one Redis
  (`REDIS_KEY_PREFIX` in API server ≥ 0.1.9)

### CLI workflow (all topologies share the same `langgraph.json`)

```bash
# 1. Author graph locally with hot-reload (no Docker)
langgraph dev --port 2024 --no-browser

# 2. Validate full Postgres+Redis stack locally before shipping
langgraph up --wait --port 8123

# 3a. Cloud deploy (new or update existing deployment)
LANGSMITH_API_KEY=... langgraph deploy

# 3b. Self-hosted Docker build
langgraph build -t my-org/my-agent:latest --platform linux/amd64

# 3c. Generate Dockerfile for customisation (must re-run after editing langgraph.json)
langgraph dockerfile Dockerfile.generated
```

---

## Step 4 — Output & Verification

After any deployment action, confirm the following:

```bash
# Liveness / readiness
curl -s http://localhost:8123/ok                  # → {"status":"ok"}

# Server metadata and version
curl -s http://localhost:8123/info | python3 -m json.tool

# List graphs available on the server
curl -s http://localhost:8123/assistants/search \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}' | python3 -m json.tool

# Quick smoke-test: create thread + run
curl -s -X POST http://localhost:8123/threads \
  -H "Content-Type: application/json" -d '{}' | python3 -m json.tool
```

For Cloud deployments, the deployment URL is displayed in the LangSmith UI and returned by
`langgraph deploy`. Replace `http://localhost:8123` with your deployment URL and add the
`x-api-key: $LANGSMITH_API_KEY` header.

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/topologies.md](references/topologies.md) | Deployment topologies, Postgres/Redis requirements, Helm chart, license keys, scaling | Research §§1, 8, Self-Hosted Lite Compose |
| [references/langgraph-json.md](references/langgraph-json.md) | `langgraph.json` schema, all fields, CLI commands and flags | Research §§2, 3 |
| [references/agent-server-api.md](references/agent-server-api.md) | Full REST API surface — Assistants, Threads, Runs, Crons, Store, Streaming, Webhooks, A2A, MCP | Research §§4a–4j |
| [references/langgraph-sdk.md](references/langgraph-sdk.md) | Python SDK — client factory, all sub-clients, streaming, RemoteGraph, agent-chat-ui | Research §§5, 7 |

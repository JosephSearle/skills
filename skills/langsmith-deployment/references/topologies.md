# Deployment Topologies Reference

## Topology Comparison

| Dimension | Cloud (SaaS) | Standalone / Self-Hosted Lite | Hybrid (Enterprise) | Self-Hosted Enterprise / BYOC |
|---|---|---|---|---|
| Data residency | LangChain AWS+GCP (US or EU region set by org) | Your infra entirely | Data plane in your VPC; control plane SaaS | Fully your cloud/VPC |
| Who manages infra | LangChain | You | LangChain manages control plane; you run data plane | You |
| Plan required | Plus or above | Free (node-limited) / enterprise license for prod scale | Enterprise | Enterprise |
| Scaling model | Auto, managed | You (HPA/manual; no serverless) | You scale data plane; control plane is managed | You (HPA/KEDA on K8s) |
| Maintenance burden | Lowest | Medium–high | Medium | Highest |
| Postgres/Redis | Provisioned automatically | BYO | BYO (custom URIs allowed) | BYO |
| License key | N/A (managed) | `LANGGRAPH_CLOUD_LICENSE_KEY` required for prod | Required | Required |
| Custom Postgres URI | No | No | Yes — `POSTGRES_URI_CUSTOM` | Yes |
| Custom Redis URI | No | No | Yes — `REDIS_URI` | Yes |
| Redis Cluster support | No | No | No | Yes — `REDIS_CLUSTER=True` |
| MongoDB checkpointing | No | Standalone Helm chart v0.2.6+ only | No | Standalone Helm chart v0.2.6+ only |

### Decision guidance

| Situation | Recommended topology |
|---|---|
| Fastest time to prod, US/EU residency acceptable, managed SaaS OK | Cloud |
| Data must stay in your VPC, want managed control-plane convenience | Hybrid |
| Full air-gap, compliance, or self-managed CI/CD pipeline | Self-Hosted Enterprise / BYOC |
| Dev, internal tools, no control plane required | Standalone / Self-Hosted Lite |
| Free evaluation, limited node budget (≤100k nodes/month) | Standalone Lite (Developer plan) |

---

## Infrastructure Requirements (Self-Hosted, Hybrid, BYOC)

### PostgreSQL

| Requirement | Detail |
|---|---|
| Minimum version | PostgreSQL **≥ 14** (versions below 14 are not supported) |
| Required extension | `pgvector` (for semantic search in the long-term memory Store) |
| What it stores | Assistants, threads, runs, crons, checkpoints, long-term memory Store — **everything** |
| What it does NOT store | Nothing is excluded — Postgres is the complete durable layer |
| Sharing across deployments | Multiple deployments may share one Postgres cluster using separate databases |
| Custom URI env var | `POSTGRES_URI_CUSTOM` (Hybrid/Self-Hosted only) |
| MongoDB alternative | MongoDB can replace Postgres for **checkpoints only**; Postgres is still required for assistants, threads, runs, crons, and Store |
| MongoDB support | Standalone Agent Server Helm chart **v0.2.6+** only |
| Pool sizing guidance | `LANGGRAPH_POSTGRES_POOL_MAX_SIZE // N_JOBS_PER_WORKER` connections allocated per worker when `BG_JOB_ISOLATED_LOOPS=True` |

> **Production recommendation:** Use a managed service (AWS RDS, Cloud SQL, Azure Database for PostgreSQL) rather than an in-cluster StatefulSet. Postgres is the write bottleneck under high load — size it generously (4 CPU / 16 GB minimum for high-write workloads; 8 CPU / 32 GB limits for 500 write rps).

### Redis

| Requirement | Detail |
|---|---|
| Minimum version | Redis **≥ 5** (versions below 5 are not supported) |
| What it stores | **Nothing durable.** Pub/sub channels for streaming SSE output; ephemeral run attempt counters (max 3 retries for transient Postgres errors, short TTL); transient worker coordination metadata |
| What it does NOT store | User data, run data, checkpoints, assistant configs, thread state — none |
| Sharing across deployments | Multiple deployments may share one Redis using `REDIS_KEY_PREFIX` (API server ≥ 0.1.9) |
| Custom URI env var | `REDIS_URI` (Hybrid/Self-Hosted only) |
| Redis Cluster mode | `REDIS_CLUSTER=True` — **Self-Hosted/BYOC only**, not supported on Cloud or Hybrid |
| Memory sizing | Modest (ephemeral only); 2 GiB is sufficient for most workloads |

> **Production recommendation:** Use managed OSS Redis (AWS ElastiCache for Redis, not Redis Enterprise). Do NOT use Redis Enterprise unless you have confirmed compatibility — the reference AWS architecture uses ElastiCache OSS Redis explicitly.

---

## License Key Mechanism

| Key | Required for | Validation |
|---|---|---|
| `LANGGRAPH_CLOUD_LICENSE_KEY` | Self-hosted / standalone production Agent Server | Validated **once at server startup** |
| `LANGSMITH_LICENSE_KEY` | Full self-hosted LangSmith platform (Helm `langsmith` chart) | Validated at startup |
| `LANGSMITH_API_KEY` | `langgraph dev`, `langgraph up` (local testing), `langgraph deploy` (Cloud) | Sent as `X-Api-Key` header |

> **⚠️ v0.12:** The Helm chart `langgraph-cloud` (Self-Hosted LangSmith) previously required a **second, separate deployment license key**. This was **removed in v0.12** (October 23, 2025). Remove `config.langgraphPlatform` from your Helm values — all deployment config now lives under `config.deployment`.

**Egress requirement:** License validation and usage reporting require outbound HTTPS to
`https://beacon.langchain.com`. In air-gapped environments, contact LangChain for an offline
license token. Usage telemetry metadata is reported for billing — this cannot be disabled on
licensed plans.

---

## Kubernetes Helm Deployment

### Charts

| Chart | What it deploys | Helm repo |
|---|---|---|
| `langchain/langgraph-cloud` | Agent Server only (data plane) | `https://langchain-ai.github.io/helm/` |
| `langchain/langsmith` | Full LangSmith platform including Agent Server | `https://langchain-ai.github.io/helm/` |

### Add the repo and install

```bash
helm repo add langchain https://langchain-ai.github.io/helm/
helm repo update

# Agent Server only (BYOC / Self-Hosted data plane)
helm install langgraph-cloud langchain/langgraph-cloud \
  --namespace langgraph \
  --create-namespace \
  --values langgraph_cloud_config.yaml

# Full LangSmith platform
helm install langsmith langchain/langsmith \
  --namespace langsmith \
  --create-namespace \
  --values langsmith_config.yaml
```

### Cluster sizing

| Deployment scope | Minimum | Recommended |
|---|---|---|
| Agent Server only (`langgraph-cloud` chart) | 1 vCPU, 4 GB memory | Size to workload — Postgres is the bottleneck |
| Full LangSmith platform (`langsmith` chart) | — | ≥ 16 vCPUs, 64 GB memory available |

**Tested platforms:** GKE, EKS, AKS, OpenShift, Minikube.

### Key Helm values (langgraph-cloud chart)

```yaml
# langgraph_cloud_config.yaml — minimal production example
config:
  deployment:                          # formerly config.langgraphPlatform (removed v0.12)
    licenseKey: ""                     # set via --set or external secret; maps to LANGGRAPH_CLOUD_LICENSE_KEY
    postgresUri: ""                    # maps to POSTGRES_URI_CUSTOM
    redisUri: ""                       # maps to REDIS_URI
    numberOfJobsPerWorker: 10          # maps to N_JOBS_PER_WORKER
    apiReplicas: 2
    queueReplicas: 3
```

### Scaling guidance (Helm)

```yaml
# High-write example (5 read / 500 write rps)
config:
  deployment:
    apiReplicas: 6
    queueReplicas: 10
    numberOfJobsPerWorker: 50

# Postgres requests/limits at this scale
postgres:
  resources:
    requests:
      cpu: "4"
      memory: "16Gi"
    limits:
      cpu: "8"
      memory: "32Gi"

# Redis sizing (ephemeral only)
redis:
  resources:
    requests:
      memory: "2Gi"
```

Autoscaling is **disabled by default**. Enable HPA for the queue worker deployment to handle
bursty traffic; KEDA is available for advanced event-driven scaling. Cap `maxReplicas` to
prevent runaway Postgres connections.

---

## AWS Reference Architecture

```
Route 53
  └─ ALB + WAF
       └─ EKS Ingress Controller
            ├─ LangSmith API Server Pods (stateless; HPA)
            ├─ LangGraph Queue Worker Pods (stateless; HPA or KEDA)
            └─ [other LangSmith services]

External dependencies (managed services):
  ├─ RDS PostgreSQL ≥14 with pgvector extension
  ├─ ElastiCache for Redis (OSS Redis, NOT Redis Enterprise)
  └─ S3 (for assets/blobs if used)

Observability:
  ├─ CloudWatch (container logs, ALB metrics)
  └─ OpenTelemetry → OTLP endpoint (APM traces)
```

Terraform modules are available for AWS and Azure. IaC source: `langchain-ai/helm` repo
infrastructure directory.

---

## Self-Hosted Lite — Complete Docker Compose

Build your image first: `langgraph build -t my-image`. Then:

```yaml
# docker-compose.yml
volumes:
  langgraph-data:
    driver: local

services:
  langgraph-redis:
    image: redis:6
    healthcheck:
      test: redis-cli ping
      interval: 5s
      timeout: 1s
      retries: 5

  langgraph-postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - langgraph-data:/var/lib/postgresql/data
    healthcheck:
      test: pg_isready -U postgres
      start_period: 10s
      timeout: 1s
      retries: 5
      interval: 5s

  langgraph-api:
    image: ${IMAGE_NAME}
    ports:
      - "8123:8000"
    depends_on:
      langgraph-redis:
        condition: service_healthy
      langgraph-postgres:
        condition: service_healthy
    environment:
      REDIS_URI: redis://langgraph-redis:6379
      DATABASE_URI: postgres://postgres:postgres@langgraph-postgres:5432/postgres?sslmode=disable
      LANGSMITH_API_KEY: ${LANGSMITH_API_KEY}
      # Production self-hosting — also set:
      # LANGGRAPH_CLOUD_LICENSE_KEY: ${LANGGRAPH_CLOUD_LICENSE_KEY}
      # N_JOBS_PER_WORKER: 10
```

The Agent Server listens on container port **8000**, mapped to host port **8123**. State
persists in Postgres. Streaming events flow through Redis pub/sub — no data is written.

---

## Rebrand Timeline

| Date | Event |
|---|---|
| Mid-May 2025 (≈ May 14) | LangGraph Platform general availability |
| October 23, 2025 | Self-Hosted v0.12 changelog formalizes rebrand to **LangSmith Deployment / Agent Server** |
| October 23, 2025 | Second deployment license key removed from Helm chart; `config.langgraphPlatform` → `config.deployment` |
| October 23, 2025 | `langgraph deploy` added as a **new CLI command** (not a rename of any existing command) |

All artifacts — `langgraph.json`, `langgraph-cli`, `langgraph-sdk`, Studio, REST API — are
unchanged by the rebrand. Only branding and Helm config key paths moved.

---

## Production Gotchas

| Failure mode | Root cause | Remedy |
|---|---|---|
| Runs lost on restart | Scale-to-zero serverless host kills container mid-run | Use always-on compute (EKS/ECS/VMs); never serverless |
| "Redis < 5 not supported" error at startup | Outdated Redis image | Pin `redis:6` or newer; use `redis:7` for latest |
| "Postgres < 14 not supported" error at startup | Outdated Postgres | Pin `postgres:14` or newer; `postgres:16` recommended |
| Store semantic search returns no results | `pgvector` extension not installed | Run `CREATE EXTENSION IF NOT EXISTS vector;` on your DB |
| License validation fails with no internet | Egress to beacon.langchain.com blocked | Open egress or obtain offline license token from LangChain |
| Workers not scaling | HPA disabled by default | Enable HPA on queue worker deployment; set CPU/memory targets |
| Multiple deployments interfering via Redis | Shared Redis without key isolation | Set `REDIS_KEY_PREFIX` to a unique value per deployment (API server ≥ 0.1.9) |
| Helm upgrade fails after v0.12 | Old `config.langgraphPlatform` keys still present in values | Migrate to `config.deployment.*`; remove second license key param |
| High Postgres CPU at scale | Postgres is the durable write bottleneck | Increase CPU/memory; reduce `N_JOBS_PER_WORKER` or add read replicas |
| `BG_JOB_ISOLATED_LOOPS` + small pool → connection exhaustion | Each worker gets `pool_max // N_JOBS` connections | Increase `LANGGRAPH_POSTGRES_POOL_MAX_SIZE` proportionally |

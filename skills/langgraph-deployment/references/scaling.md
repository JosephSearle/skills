# Scaling Reference

## Why LangGraph Server scales horizontally

LangGraph Server containers are **stateless**. All mutable state lives in:
- **Postgres** — thread/checkpoint/run data (durable)
- **Redis** — pub-sub channels for SSE streaming (ephemeral)

Any replica can serve any request. No sticky sessions at the application layer.

## Basic horizontal scale config (docker-compose)

```yaml
services:
  langgraph:
    image: my-agent:latest
    deploy:
      replicas: 4
      resources:
        limits:
          cpus: "2"
          memory: 4G
    environment:
      POSTGRES_URI: postgresql://langgraph:pass@postgres:5432/langgraph
      REDIS_URI: redis://redis:6379
```

## Kubernetes deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langgraph-server
spec:
  replicas: 4
  selector:
    matchLabels:
      app: langgraph-server
  template:
    metadata:
      labels:
        app: langgraph-server
    spec:
      containers:
        - name: langgraph-server
          image: my-agent:latest
          ports:
            - containerPort: 8000
          env:
            - name: POSTGRES_URI
              valueFrom:
                secretKeyRef:
                  name: langgraph-secrets
                  key: postgres-uri
            - name: REDIS_URI
              valueFrom:
                secretKeyRef:
                  name: langgraph-secrets
                  key: redis-uri
          resources:
            requests:
              cpu: "1"
              memory: 2Gi
            limits:
              cpu: "2"
              memory: 4Gi
          readinessProbe:
            httpGet:
              path: /ok
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: langgraph-server
spec:
  selector:
    app: langgraph-server
  ports:
    - port: 80
      targetPort: 8000
  type: LoadBalancer
```

## SSE streaming and Redis

When a client opens a streaming run (`POST /threads/{id}/runs/stream`), the request can be
served by any replica. The serving replica subscribes to a Redis pub-sub channel for the
thread. The executing replica publishes events to that channel. Both replicas do not need to
be the same instance.

Redis Sentinel (not Cluster) is the recommended HA configuration — LangGraph Server uses
pub-sub which has limited Cluster support.

## Postgres connection pooling

With many replicas, each opens its own connection pool to Postgres. At 4 replicas × 10
pool size = 40 connections. Use PgBouncer in transaction mode to limit actual DB connections:

```yaml
services:
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_DBNAME: langgraph
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 200
      PGBOUNCER_DEFAULT_POOL_SIZE: 20
    ports:
      - "6432:5432"
```

Then point `POSTGRES_URI` to PgBouncer's port.

## Autoscaling guidance

| Metric | Scale-out threshold |
|---|---|
| CPU utilisation | > 70% for 3+ minutes |
| Active run count | > (replicas × 10) |
| SSE connection count | > (replicas × 50) |

LangGraph runs are CPU-bound during graph execution and I/O-bound during LLM calls. Profile
your specific agent to set appropriate thresholds.

## Redis HA with Sentinel

```yaml
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}

  redis-sentinel:
    image: redis:7-alpine
    command: >
      redis-sentinel /etc/sentinel.conf
    volumes:
      - ./sentinel.conf:/etc/sentinel.conf
```

`REDIS_URI` with Sentinel: `redis+sentinel://sentinel1:26379/mymaster/0`

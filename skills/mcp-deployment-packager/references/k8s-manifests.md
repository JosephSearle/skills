# Kubernetes Manifests Reference

## Deployment Minimum Requirements

For an MCP server in production, the Deployment MUST have:
1. `livenessProbe` — restarts the pod if the process is stuck
2. `readinessProbe` — stops traffic to the pod until it's ready
3. `terminationGracePeriodSeconds` — aligned with NestJS graceful shutdown window
4. `resources.requests` and `resources.limits` — required for HPA and QoS Guaranteed
5. Secrets via `secretKeyRef` — never hardcoded values

---

## Probe Configuration

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3000
  initialDelaySeconds: 15   # longer than startup time; too short = restart loop
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3        # 3 failures = restart

readinessProbe:
  httpGet:
    path: /readyz
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2        # 2 failures = stop sending traffic
  successThreshold: 1
```

**Critical:** `/healthz` must return 200 without checking Redis or DB. If liveness checks Redis, a Redis outage causes a pod restart loop.

---

## SIGTERM and Graceful Shutdown

When K8s terminates a pod, it sends SIGTERM and waits `terminationGracePeriodSeconds` before sending SIGKILL.

NestJS graceful shutdown (`app.enableShutdownHooks()`) drains in-flight requests and closes pools on SIGTERM.

```yaml
spec:
  terminationGracePeriodSeconds: 30  # must be > NestJS drain time (default 15s)
```

Timeline:
```
K8s sends SIGTERM
  └─ NestJS: stop accepting new connections
  └─ NestJS: drain in-flight requests (up to 15s)
  └─ NestJS: close Redis, DB pools
  └─ NestJS: exit 0
K8s sends SIGKILL after 30s (if process hasn't exited)
```

---

## Security Context

```yaml
securityContext:
  runAsUser:                1001     # numeric UID — works without /etc/passwd
  runAsGroup:               1001
  runAsNonRoot:             true
  readOnlyRootFilesystem:   true     # process cannot write to the image filesystem
  allowPrivilegeEscalation: false
  capabilities:
    drop: [ALL]
```

If `readOnlyRootFilesystem: true`, add a `tmpfs` volume for any temp file writes:
```yaml
volumes:
  - name: tmp
    emptyDir: {}
volumeMounts:
  - name: tmp
    mountPath: /tmp
```

---

## Secrets via secretKeyRef

```yaml
env:
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: mcp-server-secrets
        key:  jwt-secret
  - name: REDIS_URL
    valueFrom:
      secretKeyRef:
        name: mcp-server-secrets
        key:  redis-url
```

Create the secret:
```bash
kubectl create secret generic mcp-server-secrets \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=redis-url="redis://redis-service:6379"
```

Never use `env.value:` for secrets — they appear in `kubectl describe pod`.

---

## Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

Requires `resources.requests.cpu` to be set on the Deployment.
When HPA is active, ensure Redis-backed rate limiting is configured (in-memory fails with multiple replicas).

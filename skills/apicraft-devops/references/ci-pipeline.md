# CI/CD Pipeline

**Authority:** docs.nestjs.com/deployment

---

## Pipeline Stage Order

```
1. biome check          ← lint + format check (fast, ~0.5s)
2. tsc --noEmit         ← type checking (no emit, ~5-15s)
3. vitest unit          ← unit tests, no DB (fast, ~10-30s)
4. vitest integration   ← real DB via Testcontainers (~1-5 min)
5. vitest E2E           ← full HTTP stack (~30s-2 min)
6. nest build           ← compile TypeScript to dist/
7. security scan        ← Trivy or Snyk vulnerability scan
8. docker build + push  ← build production image
9. DB migration         ← prisma migrate deploy (before app rollout)
10. deploy              ← rolling deploy with readiness probe
```

Fail fast: if any stage fails, subsequent stages don't run. Unit tests before integration keeps the feedback loop fast.

---

## GitHub Actions Example

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, 'feat/**']
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx biome check .
      - run: npx tsc --noEmit

  unit-tests:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test  # vitest run (unit only, exclude __integration__ and test/)
      - run: npm run test:cov
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  integration-tests:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration  # vitest run --include 'src/**/__integration__/**'
        env:
          DOCKER_BUILDKIT: '1'
        # Testcontainers starts Postgres/Redis automatically via Docker

  build:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Run DB migrations
        run: |
          # Run against production DB before the app rollout
          npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Deploy to Kubernetes
        run: kubectl set image deployment/api api=ghcr.io/${{ github.repository }}:${{ github.sha }}
```

---

## Zero-Downtime Deploy Pattern

Zero-downtime requires the readiness probe to gate traffic until the new instance is healthy:

```yaml
# kubernetes deployment.yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # allow 1 extra pod during rollout
      maxUnavailable: 0  # never take down a pod until the replacement is ready
  template:
    spec:
      containers:
        - name: api
          image: my-api:latest
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
          lifecycle:
            preStop:
              exec:
                command: ['/bin/sh', '-c', 'sleep 5']  # drain in-flight requests
          terminationGracePeriodSeconds: 30
```

The sequence on deploy:
1. Kubernetes starts new pod → readiness probe returns `503` until DB connection established
2. New pod passes readiness → Kubernetes routes traffic to it
3. Old pod receives SIGTERM → `preStop` sleep drains in-flight requests → NestJS shutdown hooks run → process exits
4. Old pod removed from load balancer

→ See `apicraft-observability` for health check implementation (`/health/live`, `/health/ready`).

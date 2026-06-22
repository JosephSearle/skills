---
name: webcraft-openshift-deploy
description: >
  Deploy a Next.js app on OpenShift using standalone output and a UBI9 Node 20
  Dockerfile. Covers next.config.js standalone mode, multi-stage Docker builds,
  OpenShift arbitrary UID compliance (chmod g=u, USER 1001), health check endpoints
  for liveness/readiness probes, ConfigMap/Secret env injection, and Tekton pipeline
  task outline. Requires webcraft-nextjs-architecture.
  Triggers on: "deploy Next.js", "OpenShift container", "Dockerfile Next.js",
  "standalone output", "UBI Node", "OpenShift arbitrary UID", "health check endpoint",
  "ConfigMap env Next.js", "Tekton Next.js build", "containerise Next.js". Not for
  local dev setup — use webcraft-nextjs-architecture for that.
---

# webcraft-openshift-deploy

Deploying Next.js on OpenShift has two mandatory requirements that differ from standard Docker deployments: **Next.js must use `output: 'standalone'`** (reduces image size by 80–90% and produces a self-contained `server.js`) and **the container must be non-root and arbitrary-UID compliant** (OpenShift's Security Context Constraints assign random UIDs at runtime — the image must handle this).

---

## Core Philosophy

**`output: 'standalone'` is not optional for OpenShift.** The standalone build traces dependencies and copies only the files actually used by the app. Without it, the Docker image includes all of `node_modules` (~300–500 MB). With it, the runtime image is typically 80–120 MB. OpenShift image size limits and registry storage costs make this non-negotiable for production.

**OpenShift runs containers as arbitrary UIDs.** The SCC (Security Context Constraint) system assigns a random UID (e.g., `1000570000`) at pod creation time. The container image must not hardcode file ownership to a specific UID — instead, the group (`0`) must have the same permissions as the owner. The `chmod -R g=u` pattern achieves this: whatever the owner can do, the group (which OpenShift uses for the assigned UID) can also do.

---

## Step 1 — Detect existing setup

```
Check next.config.js:
  └─ Does it have output: 'standalone'?
       └─ NO → add it (Step 3 — Next.js config)

Check root directory:
  └─ Does Dockerfile exist?
       └─ NO → create it (Step 3 — Dockerfile)
       └─ YES → check for UBI base image and USER 1001

Check app/api/health/route.ts:
  └─ Does health endpoint exist?
       └─ NO → create it (Step 3 — Health endpoint)

Check OpenShift manifests (if present):
  └─ Is there a Deployment/DeploymentConfig referencing the image?
       └─ Check env vars are from ConfigMap/Secret, not hardcoded
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Configuring standalone output or understanding what it produces
  │    → load references/nextjs-standalone.md
  ├─ Writing or debugging the Dockerfile
  │    → load references/openshift-dockerfile.md
  └─ Health check endpoints, env injection, or Tekton pipeline
       → load references/health-and-config.md
```

---

## Step 3 — Execute

### next.config.js standalone mode

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  sassOptions: {
    includePaths: ['./node_modules'],
    prependData: `@use '@carbon/react/scss/config' with ($prefix: 'cds');`,
  },
}
module.exports = nextConfig
```

### Health check endpoint

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}
```

### Dockerfile

```dockerfile
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS base

# ── Build stage ──────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone output
COPY --from=builder --chown=1001:0 /app/.next/standalone ./
# Copy static assets (standalone does not include these)
COPY --from=builder --chown=1001:0 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:0 /app/public ./public

# OpenShift arbitrary UID: group 0 must have same permissions as owner
RUN chmod -R g=u /app

EXPOSE 3000
USER 1001
CMD ["node", "server.js"]
```

---

## Step 4 — Validate

- [ ] `next.config.js` has `output: 'standalone'`
- [ ] Dockerfile uses `registry.access.redhat.com/ubi9/nodejs-20:latest` as base
- [ ] Dockerfile is multi-stage (builder + runner)
- [ ] Runtime stage copies `.next/standalone`, `.next/static`, and `public`
- [ ] `--chown=1001:0` on all `COPY` instructions in runner stage
- [ ] `RUN chmod -R g=u /app` present in runner stage
- [ ] `USER 1001` set before `CMD`
- [ ] `ENV HOSTNAME="0.0.0.0"` set (Next.js standalone binds to `::1` by default without this)
- [ ] `app/api/health/route.ts` returns `200 { status: 'ok' }`
- [ ] No secrets or API keys in the Dockerfile or `ENV` instructions — use ConfigMap/Secret

---

## Reference Files

- [references/nextjs-standalone.md](references/nextjs-standalone.md) — `output: 'standalone'` mechanics, what it produces, static asset copying requirement, size comparison. **Load for standalone config questions.**
- [references/openshift-dockerfile.md](references/openshift-dockerfile.md) — UBI9 Node 20 base image, multi-stage build pattern, arbitrary UID compliance (`chmod g=u`, `USER 1001`), `HOSTNAME` env var. **Load for Dockerfile creation or debugging.**
- [references/health-and-config.md](references/health-and-config.md) — `/api/health` route, OpenShift liveness/readiness probe YAML, ConfigMap/Secret env injection, Tekton pipeline task outline. **Load for OpenShift manifest setup.**

---

## Source Documentation

All content is grounded in [nextjs.org/docs/app/api-reference/next-config-js/output](https://nextjs.org/docs/app/api-reference/next-config-js/output), [catalog.redhat.com/software/containers/ubi9/nodejs-20](https://catalog.redhat.com/software/containers/ubi9/nodejs-20/), and [docs.openshift.com/container-platform/4.14/openshift_images/create-images.html](https://docs.openshift.com/container-platform/4.14/openshift_images/create-images.html).

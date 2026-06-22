# OpenShift Dockerfile Reference

> Authority: [docs.openshift.com/container-platform/4.14/openshift_images/create-images.html](https://docs.openshift.com/container-platform/4.14/openshift_images/create-images.html) and [catalog.redhat.com/software/containers/ubi9/nodejs-20](https://catalog.redhat.com/software/containers/ubi9/nodejs-20/)

OpenShift imposes security constraints that differ from standard Docker: containers run as non-root arbitrary UIDs, and images must be built from approved base images.

---

## Required base image

```dockerfile
FROM registry.access.redhat.com/ubi9/nodejs-20:latest
```

| Requirement | Why |
|-------------|-----|
| UBI9 (Red Hat Universal Base Image) | Enterprise OpenShift approved; passes security scan |
| Node 20 | LTS, aligns with Next.js 15 support matrix |
| `registry.access.redhat.com` | Red Hat registry — available without authentication in enterprise environments |

Do not use `node:20-alpine` or `node:20-slim` — these are not approved in enterprise OpenShift environments.

---

## Full production Dockerfile

```dockerfile
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS base

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Install dependencies first (layer cache optimisation)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Required: Next.js standalone binds to ::1 (IPv6 loopback) without this
ENV HOSTNAME="0.0.0.0"

# Copy only what the standalone server needs
COPY --from=builder --chown=1001:0 /app/.next/standalone ./
COPY --from=builder --chown=1001:0 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:0 /app/public ./public

# OpenShift arbitrary UID compliance:
# OpenShift assigns a random UID at runtime (e.g. 1000570000).
# That UID is in group 0. chmod g=u ensures group 0 has the same
# permissions as the owner (1001), so the assigned UID can write to /app.
RUN chmod -R g=u /app

EXPOSE 3000

# Switch to non-root user
USER 1001

CMD ["node", "server.js"]
```

---

## OpenShift arbitrary UID explained

Standard Linux permission model:
```
file: -rw-r--r-- owner:1001 group:0
```

When OpenShift assigns UID `1000570000`:
- The process UID is `1000570000`
- The process GID is `0` (group 0 / root group)
- The file owner `1001` doesn't match
- Without `chmod g=u`: the process can only read (group `r--`) — can't write

After `chmod -R g=u /app`:
```
file: -rw-rw-r-- owner:1001 group:0
```
Now the group (which includes the OpenShift-assigned UID) has read+write permissions.

---

## Common Dockerfile mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `ENV HOSTNAME="0.0.0.0"` | App starts but pod never becomes Ready (binds to `::1`) | Add `ENV HOSTNAME="0.0.0.0"` |
| Missing `.next/static` copy | 404 on all CSS and JS | Add `COPY .next/static ./.next/static` |
| Missing `public/` copy | 404 on images and other public assets | Add `COPY public ./public` |
| Missing `chmod -R g=u` | `Permission denied` errors on write operations | Add `RUN chmod -R g=u /app` |
| `USER 0` or running as root | Pod rejected by SCC | Use `USER 1001` |
| Alpine/slim base image | Security scan rejection in enterprise OpenShift | Use UBI9 base |

---

## .dockerignore

```
.next
node_modules
.git
*.md
.env*
.DS_Store
coverage/
storybook-static/
```

Exclude `.next` because it's rebuilt in the builder stage. Exclude `.env*` to prevent secrets from entering the image.

---

## Build arguments for CI

```dockerfile
ARG BUILD_ENV=production
ENV NODE_ENV=${BUILD_ENV}
```

Pass at build time:
```bash
docker build --build-arg BUILD_ENV=staging -t myapp:staging .
```

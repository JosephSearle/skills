# Dockerfile Patterns Reference

## Multi-Stage Build Structure

```
Stage 1: builder
  - Base: full Node.js image (node:22-slim or node:22)
  - Install all dependencies (including devDependencies for TypeScript compilation)
  - Run tsc or nest build
  - Prune devDependencies for the runtime stage

Stage 2: runtime
  - Base: minimal image (UBI 10, distroless, or alpine)
  - Copy only: dist/, node_modules/ (production), package.json
  - Create non-root user
  - Set USER
  - Set HEALTHCHECK
  - EXPOSE port
  - CMD
```

Benefits:
- Runtime image has no TypeScript compiler, test dependencies, or source files.
- Smaller attack surface.
- Smaller image (typically 50–80% smaller than single-stage).

---

## UBI 10 Pattern

```dockerfile
# Stage 1: builder
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                          # install all deps including devDeps
COPY . .
RUN npm run build                   # nest build / tsc
RUN npm prune --omit=dev            # remove devDeps from node_modules

# Stage 2: runtime — RHEL/FIPS compatible
FROM registry.access.redhat.com/ubi10-minimal AS runtime
WORKDIR /app

# Install Node.js in UBI (it's not pre-installed in ubi10-minimal)
RUN microdnf install -y nodejs && microdnf clean all

# Non-root user
RUN groupadd -r -g 1001 mcp && useradd -r -u 1001 -g mcp mcp

# Copy build artifacts only — no source, no devDeps
COPY --from=builder --chown=mcp:mcp /app/dist ./dist
COPY --from=builder --chown=mcp:mcp /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:mcp /app/package.json ./

USER 1001

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3000/healthz || exit 1

CMD ["node", "dist/main.js"]
```

---

## Distroless Pattern

```dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Distroless: no shell, no package manager, minimal attack surface
FROM gcr.io/distroless/nodejs22-debian12 AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Distroless runs as non-root by default (user 65532: nonroot)
# No HEALTHCHECK possible (no curl/wget) — rely on K8s probes
EXPOSE 3000
CMD ["dist/main.js"]
```

---

## Non-Root User Rules

- Use numeric UID in K8s `securityContext.runAsUser` — works even without `/etc/passwd`.
- Use `--chown=mcp:mcp` in `COPY` to avoid a `chown` layer.
- `readOnlyRootFilesystem: true` in K8s securityContext — add a `tmpdir` volume if the app writes temp files.

---

## Image Pinning

Always pin to a specific digest or minor version tag in production:

```dockerfile
# BAD: :latest — non-reproducible, may introduce breaking changes
FROM node:latest

# GOOD: pinned minor version
FROM node:22.15-slim

# BEST: pinned by digest (immutable)
FROM node:22.15-slim@sha256:abc123...
```

Update the pin as part of your regular dependency-update process.

---

## .dockerignore

```
node_modules/
dist/
.env
.env.*
*.test.ts
coverage/
.git/
.github/
*.md
```

Prevents large or sensitive directories from being sent to the Docker build context.

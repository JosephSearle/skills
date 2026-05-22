---
name: mcp-deployment-packager
description: >
  Packages and audits NestJS MCP servers for production container deployment: multi-stage
  Dockerfiles (UBI 10 or distroless base), non-root user configuration, HEALTHCHECK
  instructions, Trivy/Grype vulnerability gate, Kubernetes Deployment manifests with
  liveness/readiness probes, graceful SIGTERM drain, and resource limits. Use when the
  user asks to "create a Dockerfile for MCP", "containerise MCP server", "deploy MCP to
  Kubernetes", "Trivy scan MCP", "non-root container", "K8s probes", "SIGTERM graceful
  shutdown", or "multi-stage Docker build". Do NOT use for application code, auth setup
  (→ mcp-auth-guardian), or observability config (→ mcp-observability).
---

# MCP Deployment Packager

Packages NestJS MCP servers for production container deployment. Generates Dockerfiles,
K8s manifests, and Trivy CI gates.

---

## Mode: GENERATE

Use when the user wants to containerise or deploy an MCP server.

### GENERATE Checklist

- [ ] Step 1 — Choose base image (UBI 10 vs distroless)
- [ ] Step 2 — Design multi-stage Dockerfile
- [ ] Step 3 — Configure non-root user
- [ ] Step 4 — Add HEALTHCHECK instruction
- [ ] Step 5 — Design Kubernetes manifests with probes and signal handling
- [ ] Step 6 — Set up Trivy/Grype CI gate
- [ ] Step 7 — Emit templates from `assets/`

---

### Step 1 — Base image selection

| Base image | Use when | Trade-offs |
|-----------|----------|-----------|
| **UBI 10 Minimal** (`registry.access.redhat.com/ubi10-minimal`) | RHEL/FIPS compliance required; enterprise environments; need shell access for debug | Larger (~100 MB); includes basic utilities |
| **Distroless** (`gcr.io/distroless/nodejs22-debian12`) | Minimal attack surface; no shell; Google Cloud / GKE standard | Smallest (~50 MB); no shell for exec; harder to debug |
| **Node.js Alpine** (`node:22-alpine`) | Simple projects; fast builds; no compliance requirement | Not FIPS-compliant; musl libc compatibility edge cases |

For MCP servers: default to **UBI 10** unless the deployment environment specifies distroless.

> Load `references/dockerfile-patterns.md` for the full multi-stage pattern.

---

### Step 2 — Multi-stage Dockerfile structure

Two stages: **builder** (installs deps, compiles TS) and **runtime** (minimal image, no dev tools).

Key rules:
1. Install all deps including devDependencies in builder (TypeScript compilation needs them).
2. In runtime stage: copy only `dist/`, `node_modules/` (production deps only), and `package.json`.
3. Do NOT copy `.env`, source `.ts` files, or test files into the runtime image.
4. Build with `npm ci --omit=dev` in the runtime stage (or copy the pruned node_modules from builder).

Copy `assets/Dockerfile.template` as your starting point.

---

### Step 3 — Non-root user

**Never run as root** in production containers. If the process is compromised, root in the container maps to root on the host without user namespace remapping.

```dockerfile
# Create a non-root user in the runtime stage
RUN addgroup --system mcp && adduser --system --ingroup mcp mcp
USER mcp
```

For UBI:
```dockerfile
RUN groupadd -r -g 1001 mcp && useradd -r -u 1001 -g mcp mcp
USER 1001
```

Use the numeric UID in K8s `securityContext.runAsUser: 1001` — this works even if the image has no `/etc/passwd`.

---

### Step 4 — HEALTHCHECK instruction

Docker and container orchestrators use HEALTHCHECK for liveness:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1
```

For distroless (no curl/wget): use a custom health binary or rely entirely on K8s probes.

---

### Step 5 — Kubernetes manifests

Minimum viable K8s configuration:
- `livenessProbe` → `/healthz`
- `readinessProbe` → `/readyz`
- `terminationGracePeriodSeconds: 30` — matches the NestJS graceful shutdown window
- `resources.requests` and `resources.limits` — required for HPA and QoS
- Secrets via `secretKeyRef` — never `value:` for sensitive env vars

Copy `assets/k8s-deployment.template.yaml`.

> Load `references/k8s-manifests.md` for probe tuning and SIGTERM drain alignment.

---

### Step 6 — Trivy/Grype CI gate

Run a vulnerability scan on the built image as part of CI. Fail the build on HIGH or CRITICAL unfixed CVEs.

```yaml
# GitHub Actions example
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE }}
    exit-code: 1
    severity: HIGH,CRITICAL
    ignore-unfixed: true
```

For accepted exceptions: add `.trivyignore` at the repo root with CVE IDs and justifications.

> Load `references/trivy-gate.md` for full CI setup and `.trivyignore` format.

---

### GENERATE Examples

**Example 1 — Dockerfile for enterprise NestJS MCP server**
User: "Create a Dockerfile for my MCP server. It needs RHEL compliance."
1. Base: UBI 10 minimal.
2. Multi-stage: builder (node:22) → runtime (ubi10-minimal).
3. Non-root: `USER 1001`.
4. HEALTHCHECK: `curl -f http://localhost:3000/healthz`.
5. Emit `assets/Dockerfile.template`.

**Example 2 — Full Kubernetes deployment**
User: "Deploy my MCP server to Kubernetes with probes and secrets."
1. Emit `assets/k8s-deployment.template.yaml`.
2. Set `readinessProbe` → `/readyz`, `livenessProbe` → `/healthz`.
3. `terminationGracePeriodSeconds: 30`.
4. Secrets via `secretKeyRef` for `JWT_SECRET`, `REDIS_URL`, `OAUTH_CLIENT_SECRET`.

---

## Mode: AUDIT

Use when reviewing an existing Dockerfile or K8s manifest.

### AUDIT Checklist

- [ ] Step 1 — Run `scripts/audit-dockerfile.ts` against the Dockerfile
- [ ] Step 2 — Check K8s manifests for missing probes and resource limits
- [ ] Step 3 — Verify Trivy gate exists in CI
- [ ] Step 4 — Produce Markdown report with line citations

### AUDIT Findings Table

| Code | Severity | Description |
|------|----------|-------------|
| D001 | CRITICAL | Container process runs as root (no `USER` instruction) |
| D002 | HIGH | No `HEALTHCHECK` instruction in the Dockerfile |
| D003 | HIGH | Base image uses `:latest` tag — non-reproducible builds |
| D004 | CRITICAL | Secret value in `ENV` instruction — embedded in image layer |
| D005 | MEDIUM | Single-stage Dockerfile — dev tools and source included in runtime image |
| D006 | HIGH | K8s Deployment missing `livenessProbe` or `readinessProbe` |

### AUDIT Examples

**Example 3 — Audit a Dockerfile**
User: "Audit my Dockerfile."
1. Run: `npx ts-node scripts/audit-dockerfile.ts Dockerfile`
2. D001 is CRITICAL — check first.
3. Report each finding with line number and fix.

**Example 4 — Check for secrets in image**
User: "Am I accidentally embedding secrets in my image?"
1. Grep for `ENV.*SECRET`, `ENV.*PASSWORD`, `ENV.*TOKEN`, `ENV.*KEY`.
2. Flag D004 for each found.
3. Fix: use `--build-arg` (not `ENV`) for build-time values, or inject via K8s Secrets at runtime.

---

## References

- `references/dockerfile-patterns.md` — multi-stage build, UBI 10 vs distroless, non-root user, HEALTHCHECK
- `references/k8s-manifests.md` — Deployment YAML, probes, SIGTERM drain, resource limits, secret mounts
- `references/trivy-gate.md` — Trivy/Grype CI setup, .trivyignore format, scan frequency

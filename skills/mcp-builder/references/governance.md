# ITZ MCP Template — CIO Governance Standards Reference

This document captures the CIO's mandatory governance requirements for all MCP servers in the
IBM enterprise. Every server built from the ITZ NestJS template must satisfy these requirements
before it can be consumed by agents through the Enterprise MCP Gateway.

These are not implementation details — they are organisational gates. Code that is technically
correct but fails governance checks will be blocked from the gateway.

---

## Governance Pre-flight Checklist

Run this checklist at the start of every session before adding features or reviewing code.
If any item is not yet satisfied, surface it to the developer — do not silently skip it.

- [ ] **Registered** — Server is registered in APM as a Technical Service via "Onboard AI"
- [ ] **Approved** — CIO approval obtained through the Path to Production process
- [ ] **Owned** — Owned by the Enterprise Application team whose system the server exposes
- [ ] **Hosted** — Deployed on CIO Cirrus using the common CI/CD pipelines
- [ ] **mTLS** — Handled by the ContextForge MCP Gateway; no action required in the server itself
- [ ] **GET /mcp not exposed** — Server does not advertise or rely on the GET endpoint (blocked by gateway)

If the server is in active development and approval is pending, note this explicitly and
continue — but flag that governance gates must be resolved before the server goes to production.

---

## Registration

MCP servers must be registered in the CIO's Application Portfolio Management (APM) system
as a **Technical Service**, associated with the Enterprise Application the server exposes.
Registration is done through "Onboard AI", the AI agent for the CIO's Enterprise AI Platform.

**What agents must surface:**
If a server has no evidence of APM registration (no reference in README, no `SERVICE_ID` or
equivalent env var, no mention in deployment config), flag it as finding G001.

---

## Approval

MCP servers must be approved by the CIO before being hosted on the Enterprise MCP Gateway.
Approval is an extension of the CIO's **Path to Production** process and confirms:
- The Enterprise Application owner is aware of and approves the implementation
- The server is differentiated from other MCP servers in the enterprise (no duplicate scope)
- Security requirements (IAM, mTLS) are met
- MCP Server Responsibilities (this document) are fulfilled

**What agents must surface:**
A server that has not completed Path to Production approval cannot be onboarded to the
gateway and cannot be consumed by agents. Flag absence of approval evidence as finding G002.

---

## Ownership

MCP servers must be owned by the Enterprise Application team whose system the server exposes.
Ownership is recorded in the APM registration and in the server's CODEOWNERS file.

**What agents must surface:**
If no `CODEOWNERS` file exists, or the file does not list the owning Enterprise Application
team, flag it as finding G003.

---

## Transport Encryption — mTLS

mTLS is a CIO requirement for MCP servers, but for servers built on this template it is
**fully handled by the ContextForge MCP Gateway**. The gateway terminates mTLS on behalf of
all servers it fronts — no mTLS configuration is required in the NestJS application code,
the `Containerfile`, or the OpenShift manifests.

This means:
- Agents and reviewers **do not need to audit** the NestJS server for mTLS configuration.
- Do not add TLS certificate management, mTLS middleware, or cert env vars to the server —
  this is gateway responsibility, not server responsibility.
- The server communicates with the gateway over the cluster-internal network; the gateway
  handles the encrypted external channel.

---

## Gateway Access — GET /mcp is Blocked

The Enterprise MCP Gateway blocks the HTTP `GET` method on the `/mcp` endpoint. Only `POST`
is permitted.

**Impact on stateful mode:**
The `GET /mcp` endpoint is used by the MCP protocol for SSE (server-sent events), which is
required for stateful features such as progress notifications, sampling, and elicitation.
Because the gateway blocks `GET /mcp`, **these stateful features are unavailable to agents
consuming the server through the enterprise gateway** — even if `statelessMode: false` is
configured on the server.

In practice this means:
- Servers deployed on the Enterprise MCP Gateway must treat themselves as effectively stateless
  from the gateway's perspective, regardless of their `statelessMode` configuration.
- `context.reportProgress()` will not reach clients through the gateway even in stateful mode.
- Do not design tools that depend on mid-call SSE notifications when deployed through the
  enterprise gateway.

**What agents must surface:**
If a tool relies on `context.reportProgress()` or any other SSE-dependent feature, and the
server is deployed on the Enterprise MCP Gateway, flag it as finding G005.

---

## Domain Scoping

MCP servers must be scoped to a **single domain** — one coherent area of enterprise
functionality (e.g. ServiceNow Incident Management, HR Leave Management, IT Asset Inventory).

Rules:
- All tools, resources, and prompts in a server must belong to the same domain.
- A server must not expose tools from multiple unrelated systems (e.g. mixing ServiceNow
  and Workday tools in one server).

### Intent-based over resource-centric tools

The CIO standard strongly prefers **intent-based tools** over generic CRUD operations.
Intent-based tools encapsulate domain-specific workflows and business logic, reducing the
cognitive load on AI agents and enforcing business rules at the server level.

| Prefer | Over |
|---|---|
| `incident_resolve` | `incident_update` (status = resolved) |
| `ticket_escalate` | `ticket_update` (priority = high) |
| `leave_approve` | `leave_request_update` (status = approved) |
| `asset_retire` | `asset_update` (status = retired) |

Resource-centric `create`, `read`, `update`, `delete` tools are acceptable for low-level
data access, but the primary tool surface should reflect how users and agents actually
accomplish tasks — not how the backend data model is structured.

**What agents must surface:**
- If a new tool being added crosses domain boundaries, flag it as finding G006.
- If a tool is a thin CRUD wrapper when an intent-based equivalent would be more appropriate,
  flag it as finding G007 (MEDIUM — does not block merge, but should be discussed).

---

## Discoverability

MCP servers must support discovery of all tools, resources, and prompts the authenticated
user has access to. The `@rekog/mcp-nest` framework implements this automatically via:
- `tools/list` — lists tools the caller can invoke
- `resources/list` — lists resources the caller can read
- `prompts/list` — lists prompts the caller can use

No additional implementation is required for basic discoverability. However, if per-tool
access control is applied (e.g. `@ToolRoles`), the listing must reflect the caller's
permissions — tools the user cannot invoke must not appear in the list.

**What agents must surface:**
If the server disables or overrides the built-in list handlers in a way that hides tools
from authorised users, flag it as finding G008.

---

## OpenTelemetry Tracing

MCP servers must support observability via **OpenTelemetry (OTEL)** tracing. Traces are
exported to the IBM AI Observability platform and viewed in **IBM Instana**:
`https://prd-ibmciousgcp17.instana.io`

The ITZ NestJS template uses Pino with CloudEvents structured logging. OTEL tracing is a
separate concern — logging and tracing complement each other but serve different purposes.
Tracing captures the execution path and latency of each tool call; logging captures events.

---

### Step A — Subscribe the EAL to AI Observability

Before any tracing code is written, the server's Enterprise Application Listing (EAL) must
be subscribed to the **AI Observability API Connect** plan. This produces the Client ID and
Client Secret used to authenticate trace exports.

1. Open: `https://catalog.w3.apihub.ibm.com/apis/catalog/run/wxoaadponboardai--ai-observability/Introduction`
2. Create or select a consumer organisation.
3. Create an application named **exactly** with the EAL record number.
4. Subscribe the application to the **AI Observability Standard** plan.
5. Store the generated **Client ID** and **Client Secret** in a Kubernetes Secret — never in
   an application manifest or source code.

**Reuse rule:** If the same EAL already has a WXO client observability subscription or an
existing MCP server subscription, reuse those credentials — do not create a duplicate.

---

### Step B — Install packages

```bash
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

---

### Step C — Create src/tracing.ts

This file must be the **first import** in `main.ts`. OTEL must initialise before any other
library is loaded, otherwise HTTP and NestJS instrumentation will not activate.

```ts
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

if (endpoint) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'itz-mcp-server',
    }),
    traceExporter: new OTLPTraceExporter({
      url: endpoint,
      headers: parseOtelHeaders(process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS ?? ''),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
}

function parseOtelHeaders(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw.split(',')
      .filter(Boolean)
      .map(pair => pair.split('=', 2) as [string, string]),
  );
}
```

```ts
// src/main.ts — OTEL MUST be the first import
import './tracing';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
// ... rest of main.ts unchanged
```

---

### Step D — Environment variables

Add to `src/config/env.validation.ts`:

```ts
OTEL_SERVICE_NAME:                      z.string().optional(),
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:    z.string().url().optional(),
OTEL_EXPORTER_OTLP_TRACES_HEADERS:     z.string().optional(),
```

Set in the Kubernetes Secret (never in manifests or source):

```
OTEL_SERVICE_NAME=my-mcp-server
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://api.ibm.com/wxoaadponboardai/bluerun/aiobservability/api/public/otel/v1/traces
OTEL_EXPORTER_OTLP_TRACES_HEADERS=X-IBM-Client-Id=<YOUR_CLIENT_ID>,X-IBM-Client-Secret=<YOUR_CLIENT_SECRET>
```

> ⚠️ **Common mistake:** Do NOT use `OTEL_EXPORTER_OTLP_ENDPOINT` with `/v1/traces` appended.
> The SDK appends `/v1/traces` automatically to that variable, producing the double-path
> `…/v1/traces/v1/traces` which returns HTTP 404 on every export.
> Use `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` — the SDK uses this value verbatim.

---

### What you get automatically

Once configured, auto-instrumentation emits these spans without any additional code:

| Span | Source |
|---|---|
| `POST /mcp` | HTTP server auto-instrumentation |
| Outbound HTTP calls from tools | HTTP client auto-instrumentation |
| `traceparent` propagation to backends | W3C propagator — automatic |

Do not write custom middleware to parse `traceparent` or create manual tool spans. Auto-instrumentation handles it.

---

### Viewing traces

Traces appear in IBM Instana at `https://prd-ibmciousgcp17.instana.io` under the service
name set by `OTEL_SERVICE_NAME`. Access follows Cirrus Portal permissions — request via
AccessHub if needed. If the EAL has no Cirrus container yet, create an empty one in Cirrus
to enable Instana access for the project team.

---

### What agents must surface

- If `src/tracing.ts` does not exist, flag finding **O001** (HIGH).
- If `import './tracing'` is not the first line of `main.ts` (before `dotenv/config`), flag **O001** (HIGH).
- If `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is absent from `env.validation.ts`, flag **O001** (HIGH).
- If `OTEL_EXPORTER_OTLP_ENDPOINT` is used instead of `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` anywhere, flag **O003** (CRITICAL) — double-pathing will cause silent trace export failure.
- If Client ID or Client Secret appear in source code, manifests, or `.env` files committed to the repo, flag **O004** (CRITICAL).
- If outbound HTTP calls to backends do not propagate `traceparent` (check whether auto-instrumentation is active), flag **O002** (HIGH).

---

## Session State Management

This is CIO mandatory standard #12 for all MCP servers.

**The CIO position:**
- MCP servers are **strongly recommended** to be deployed in stateless mode.
- MCP servers **must** use a **shared session store** if deployed in stateful mode in a
  clustered (multi-replica) environment.

**Why this matters:** In a multi-replica cluster, any replica may receive an incoming request.
If session state is stored in-memory on a specific pod, a request routed to a different pod
will fail because that pod has no knowledge of the session initialised elsewhere. In-memory
stateful mode is only safe for single-replica deployments.

**Enforcement rules:**

```
Is the server configured as stateful (statelessMode: false)?
  └─ Is it deployed as a single replica?
       └─ YES → In-memory state is acceptable but document the constraint. Note it must
                convert to shared store before scaling to multiple replicas.
       └─ NO (multi-replica) → A shared session store (Redis) is MANDATORY.
                               Flag S009 (CRITICAL) if absent.

Is the server configured as stateless (statelessMode: true)?
  └─ No session state requirement — compliant by default.
```

**For the ITZ NestJS template**, the Redis-backed `ThrottlerStorageRedisService` is already
wired in for rate limiting. If the server is switched to stateful mode in a multi-replica
deployment, the MCP session store must also be externalised to Redis — this is separate from
the throttler Redis configuration and requires additional implementation.

**What agents must surface:**
- If `statelessMode: false` and the deployment config shows `replicas > 1` with no shared
  session store configured, flag **S009** (CRITICAL — was previously HIGH; now upgraded per
  CIO mandatory standard).
- If `statelessMode: false` even in a single-replica deployment, flag **S010** (MEDIUM) as
  a recommendation to switch to stateless unless stateful features are genuinely required.

---

## Test Automation Requirements

The CIO requires **two categories of automated tests** at a minimum:

### 1. Unit tests (already enforced by this skill)
Co-located Jest spec files covering the four mandatory paths per tool.

### 2. Deployment verification tests
Tests that run post-deployment to verify the server is correctly configured in its target
environment. These are distinct from unit tests — they hit the real deployed endpoint.

**Minimum deployment verification test surface:**

```ts
// test/deployment-verification.spec.ts (or e2e directory)

describe('Deployment verification', () => {
  const BASE_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:3000';

  it('GET /healthz returns 200', async () => {
    const res = await fetch(`${BASE_URL}/healthz`);
    expect(res.status).toBe(200);
  });

  it('GET /readyz returns 200', async () => {
    const res = await fetch(`${BASE_URL}/readyz`);
    expect(res.status).toBe(200);
  });

  it('POST /mcp without token returns 401', async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /mcp with valid token lists tools', async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'techzone-token': process.env.TEST_JWT_TOKEN ?? '',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.tools.length).toBeGreaterThan(0);
  });
});
```

**What agents must surface:**
- If no deployment verification test file exists, flag it as finding T001 (HIGH).
- If the deployment verification tests do not cover the auth rejection case (`401` without
  token), flag it as finding T002 (MEDIUM).

---

## Hosting

MCP servers built from the ITZ NestJS template must be hosted on **CIO Cirrus** using the
common CI/CD pipelines. The template ships with a multi-stage UBI10 `Containerfile` and
`tz-build.yml` for this purpose.

Vendor-provided MCP servers have different hosting rules (embedded vs add-on) — this skill
does not cover vendor-provided servers.

**What agents must surface:**
If the `Containerfile` or `tz-build.yml` has been removed or substantially modified in a way
that would prevent CIO Cirrus deployment, flag it as finding G009 (HIGH).

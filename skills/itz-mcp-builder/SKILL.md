---
name: itz-mcp-builder
description: >
  Develops, extends, and audits MCP servers built from the ITZ NestJS MCP server template.
  Enforces all template conventions and CIO governance standards: TechzoneAuthGuard JWT
  authentication, two-layer CASL authorisation, per-user Redis-backed rate limiting, Zod
  input validation, CIO tool naming rules, domain scoping, OpenTelemetry tracing, mTLS,
  ToolBusinessError error channels, CloudEvents logging, unit tests, and deployment
  verification tests. Use when the user asks to "add a tool", "create a new MCP tool",
  "add a feature to the MCP server", "audit this tool", "review my tool against template
  standards", "does this tool follow the template", "does this meet CIO standards",
  "add a resource", "add a prompt", or any instruction to develop or review code on an MCP
  server that was generated from the ITZ NestJS MCP server template.
version: 1.0.0
---

# ITZ MCP Builder

Develops and audits tools, resources, and prompts on NestJS MCP servers templated from the
ITZ hardened template. Every piece of code written by this skill must be consistent with the
seven security layers and conventions already wired into the template — adding a tool must
never weaken the security posture the template established.

> Always load `references/security-layers.md` at the start of every session. It is the
> authoritative reference for what each layer does and what agents must not break.

---

## Core Philosophy

This skill has one job: help developers add features to a pre-hardened server without
accidentally undoing the hardening. The template is opinionated by design — authentication,
rate limiting, input validation, and authorisation are already in place. Every tool written
here inherits those layers for free, but only if the tool is wired in correctly.

A tool that bypasses the auth guard, skips CASL checks, or throws raw exceptions instead of
using `ToolBusinessError` is not just wrong — it creates a gap in a security model that was
deliberately designed end-to-end. This skill exists to make that gap impossible.

---

## Step 1 — Identify Mode and Load References

```
What does the user want to do?
  └─ Add or generate a new tool / resource / prompt → Mode: ADD
  └─ Review, check, or audit existing code          → Mode: AUDIT
  └─ Ambiguous                                      → Ask: "Do you want to add something new
                                                       or review existing code?"
```

Always load `references/security-layers.md` before doing anything else — it documents all
seven layers and the rules that must not be broken.

Then load conditionally:

```
User is adding or reviewing a tool?
  └─ Load references/tool-patterns.md

User is adding or reviewing a resource or prompt?
  └─ Continue from Step 2 inline — resources and prompts follow the same Zod and auth rules
     as tools but use @Resource() / @Prompt() decorators instead of @Tool()
```

### Step 1b — Detect Transport Mode

Before writing or reviewing any tool code, read `src/app.module.ts` and determine the
server's transport mode. This affects what a tool is allowed to do.

```
Is MCP_TRANSPORT=stdio (or streamableHttp block absent)?
  └─ STDIO mode — stateful/stateless concerns do not apply; skip to Step 2

Read streamableHttp.statelessMode:
  └─ true (or field absent) → STATELESS MODE
  └─ false                  → STATEFUL MODE
```

Load `references/stateful-vs-stateless.md` and keep the detected mode in context for
Steps 5 and 8 — mode determines which capabilities are available and which patterns to enforce.

**Record the mode explicitly** before continuing:

```
Detected mode: STATELESS  ← (or STATEFUL / STDIO)
```

If the mode cannot be determined from `app.module.ts` (file not readable, config is dynamic),
ask the user: "Is this server running in stateless or stateful mode? I need to check before
writing any tool code."

### Step 1c — CIO Governance Pre-flight

Load `references/governance.md` and run the governance checklist before doing any
implementation work. Surface any gaps to the developer — do not silently skip them.

```
Is the server registered in APM as a Technical Service?
  └─ NO or unknown → Surface finding G001; note it must be done before production

Has the server completed the CIO Path to Production approval?
  └─ NO or unknown → Surface finding G002; note it blocks gateway onboarding

Does a CODEOWNERS file exist naming the Enterprise Application owner?
  └─ NO → Surface finding G003

Is mTLS in place?
  └─ Handled by the ContextForge MCP Gateway — no action required in the server itself

Is the server designed to work without GET /mcp SSE?
  └─ Tools rely on context.reportProgress() through the enterprise gateway → Surface finding G004
```

In active development (pre-production), governance gaps are surfaced as notes rather than
blockers — but they must be resolved before the server is submitted for gateway onboarding.

---

## Step 2 — Understand the Request

Before writing any code, answer these five questions. If any answer is unknown, ask — do not
assume.

| Question | Why it matters |
|---|---|
| What does this tool/resource/prompt do? | Determines Zod schema shape and error paths |
| Does it belong to this server's declared domain? | CIO requires single-domain servers — cross-domain tools must live in their own server |
| Does it read, write, or delete data? | Determines which `@ToolRoles` and CASL actions apply |
| Does it call any external service or upstream API? | Guards against token pass-through and SSRF |
| What should the LLM see if it fails? | Determines `ToolBusinessError` vs thrown exception |

Also consider: should this be an **intent-based** tool rather than a raw CRUD operation?
Prefer `incident_resolve` over `incident_update(status='resolved')`. See
`references/governance.md` → **Domain Scoping** for the full rationale and examples.

---

## Step 3 — Design the Zod Schema

Every `@Tool()`, `@Resource()`, and `@Prompt()` in this template uses a Zod schema for
parameter validation. The `ValidationPipe` (configured with `whitelist: true`,
`forbidNonWhitelisted: true`, `transform: true`) enforces this before the handler is called.

Load `references/tool-patterns.md` → **Zod Schema Rules** section.

Checklist:
- [ ] Every field has `.describe('...')` — this is the LLM's only documentation for the field
- [ ] Strings have `.max()` bounds — `name: z.string().max(500)` as shown in `greeting.tool.ts`
- [ ] Enums use `z.enum([...])` not `z.string()`
- [ ] Numeric fields have `.min()` and `.max()` bounds
- [ ] Optional fields use `.optional().default(...)` so the handler always receives a typed value
- [ ] No `z.any()` or `z.unknown()` — the ValidationPipe strips unknowns anyway

---

## Step 4 — Design the Authorisation Model

The template enforces two authorisation layers on every tool. Both must be applied.

Load `references/security-layers.md` → **Layer 5** and `references/tool-patterns.md` →
**Authorisation** section.

### 4a — Role gate (`@ToolRoles`)

```ts
@ToolRoles(['user'])          // most tools — standard authenticated user
@ToolRoles(['admin'])         // privileged tools — admin role required
@ToolRoles(['user', 'admin']) // accepts either role
```

`@ToolRoles` is evaluated by `McpModule`'s guard pipeline. Omitting it means the tool
inherits no role check — this is only acceptable for tools decorated with `@PublicTool()`
(such as `health-check`).

### 4b — CASL ability check (inside the handler)

```ts
if (request && !this.abilityService.can(request.user, 'read', 'MyResource')) {
  throw new ForbiddenException('Insufficient permissions to use this tool.');
}
```

Rules:
- Skip the CASL check only when `request` is absent (STDIO transport) — the `if (request &&`
  guard handles this correctly.
- The CASL `subject` second argument must be a string matching a registered CASL subject type.
- Abilities come from the JWT payload — no extra round-trip to an auth service is needed.
- `AbilityService` is injectable; add it to the tool's constructor.

### 4c — Public tools

Only tools that are genuinely unauthenticated (e.g. health checks) may omit auth. Use
`@PublicTool()` explicitly — do not omit `@ToolRoles` and leave auth implicit.

---

## Step 5 — Design Error Handling and Progress Reporting

The template separates two error channels. Choosing the wrong one causes silent failures or
exposes internals to the LLM.

Load `references/tool-patterns.md` → **Error Channels** section.

```
Should the LLM see this failure and self-correct?
  └─ YES → throw new ToolBusinessError('message', 'ERROR_CODE')
           The McpExceptionFilter sets result.isError: true — visible to the LLM
           Examples: entity not found, reserved keyword, quota exceeded, invalid business state

Is this an unexpected internal failure?
  └─ NO → throw new InternalServerErrorException('message')
          McpExceptionFilter maps this to JSON-RPC -32603 — NOT visible to the LLM
          Examples: database down, upstream API 500, configuration error

Is this an auth or permission failure?
  └─ throw new UnauthorizedException() or ForbiddenException()
     McpExceptionFilter maps to JSON-RPC -32600 — NOT visible to the LLM
     These are handled by the guard layers before the handler runs
```

Never throw `ToolBusinessError` for auth failures — those are guard-layer concerns.
Never throw raw `Error` — always use a NestJS HTTP exception or `ToolBusinessError`.

### Progress reporting — mode-dependent

Apply the rule that matches the mode detected in Step 1b:

```
STATELESS mode:
  └─ context.reportProgress() is a SILENT NO-OP.
     Do NOT add reportProgress() calls to tools on a stateless server.
     If the tool genuinely needs progress reporting, the server must be
     switched to stateful mode (see references/stateful-vs-stateless.md →
     "Switching from Stateless to Stateful") before the tool is written.

STATEFUL mode:
  └─ context.reportProgress() works. Use it for tools that take more than ~2 seconds.
     Report at meaningful checkpoints — not on every loop iteration.

     await context.reportProgress({ progress: 25, total: 100 });
     // ... do work ...
     await context.reportProgress({ progress: 100, total: 100 });

STDIO mode:
  └─ context.reportProgress() has no effect — there is no HTTP client to receive it.
     Do not add progress calls to stdio tools.
```

---

## Step 6 — Emit the Tool File

Create the tool at `src/tools/<domain>.tool.ts`. Follow the naming pattern established by
`greeting.tool.ts` and `calculator.tool.ts`.

Load `references/tool-patterns.md` → **File Structure** section for the canonical file shape.

### Minimum viable tool structure

```ts
import { Tool, ToolRoles } from '@rekog/mcp-nest';
import type { Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '../auth/interfaces/user.interface';
import { AbilityService } from '../auth/ability.service';
import { ToolBusinessError } from '../errors/tool-business.error';

export const MyToolSchema = z.object({
  // every field must have .describe()
  id: z.string().uuid().describe('The UUID of the resource to fetch'),
});

@Injectable()
export class MyTool {
  constructor(private readonly abilityService: AbilityService) {}

  @Tool({
    name: 'my_tool_verb_noun',           // lowercase, underscore-separated, domain_verb_noun
    description: 'One sentence: what this tool does and what it returns.',
    parameters: MyToolSchema,
  })
  @ToolRoles(['user'])
  async myTool(
    { id }: { id: string },
    context: Context,
    request?: Request & { user?: User },
  ): Promise<string> {
    if (request && !this.abilityService.can(request.user, 'read', 'MyResource')) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    // business logic here
    // LLM-visible failure:
    // throw new ToolBusinessError('Resource not found', 'NOT_FOUND');

    return 'result';
  }
}
```

### Tool naming convention

Tool names are validated by the Enterprise MCP Gateway. Invalid names cause gateway rejection.

**CIO character rules:**
- Must **start** with a letter (`a–z` or `A–Z`) — not a digit or underscore
- May contain letters, digits (`0–9`), and underscores (`_`)
- Must **not** contain spaces, periods (`.`), colons (`:`), hyphens (`-`), or any other special character

**ITZ naming pattern:** `<domain>_<verb>_<noun>` — lowercase, underscore-separated:
- ✅ `orders_list`, `orders_create`, `incident_resolve`, `user2profile`
- ❌ `list-orders` (hyphens), `incident.resolve` (periods), `2create` (starts with digit), `snow:incident` (colons)

If the underlying backend uses illegal characters (e.g. `incident.create.record`), translate
to the MCP-compliant form (`incident_create_record`) and document the mapping in the README.
See `references/tool-patterns.md` → **Tool Naming — CIO Character Rules** for the full table.

---

## Step 7 — Register in AppModule

Every new tool must be added to `src/app.module.ts`. The MCP server discovers `@Tool()`
methods only from providers registered in the module.

```ts
// src/app.module.ts — providers array
providers: [
  AppService,
  HealthService,
  AbilityService,
  GreetingTool,
  CalculatorTool,
  MyTool,           // ← add here
  CoreAuthGuard,
  ThrottlerBehindProxyGuard,
  { provide: APP_FILTER, useClass: McpExceptionFilter },
],
```

Also add the import at the top of `app.module.ts`:
```ts
import { MyTool } from './tools/my.tool';
```

Failure to register the provider means the tool is silently not exposed — the MCP server
will not error, it will simply not list the tool.

### OpenTelemetry Tracing

The CIO requires MCP servers to export traces to the **IBM AI Observability** platform
(visible in Instana). Load `references/governance.md` → **OpenTelemetry Tracing** for the
full implementation guide including the EAL subscription, correct env vars, and the IBM
endpoint URL.

Check the following before or after adding a tool:

1. Does `src/tracing.ts` exist? If not → flag **O001** (HIGH).
2. Is `import './tracing'` the **first** line of `main.ts`, before `dotenv/config`? If not → flag **O001** (HIGH).
3. Does `env.validation.ts` include `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and `OTEL_EXPORTER_OTLP_TRACES_HEADERS`? If not → flag **O001** (HIGH).
4. Does any file use `OTEL_EXPORTER_OTLP_ENDPOINT` with `/v1/traces` appended to its value? If yes → flag **O003** (CRITICAL) — this causes silent double-pathing export failure.
5. Do Client ID or Client Secret appear in source files, manifests, or committed `.env` files? If yes → flag **O004** (CRITICAL).

---

## Step 8 — Write Co-located Tests

Every tool file must have a sibling spec file: `src/tools/<domain>.tool.spec.ts`.
Tests live next to the source they test — never in a separate `__tests__` directory.

Load `references/tool-patterns.md` → **Testing** section.

Cover all four paths in every spec, plus a fifth path if the server is stateful:

| Path | When required | What to assert |
|---|---|---|
| Happy path | Always | Returns expected shape with valid input |
| CASL denied | Always | Throws `ForbiddenException` when `abilityService.can()` returns false |
| Business error | Always | Throws `ToolBusinessError` with expected code for known bad state |
| No request (STDIO) | Always | Skips CASL check and returns result when `request` is undefined |
| Progress reporting | **Stateful mode only** | `context.reportProgress` is called the expected number of times with correct values |

In stateless mode, do not test `reportProgress` — the call is a no-op and asserting on it
produces tests that pass vacuously. If the tool was written without `reportProgress` calls
(as it should be in stateless mode), there is nothing to assert.

### Deployment verification tests

In addition to unit tests, the CIO requires **deployment verification tests** that run
post-deployment against the real endpoint. Check whether `test/deployment-verification.spec.ts`
(or equivalent) exists. If not, flag finding T001 and direct the developer to
`references/governance.md` → **Test Automation Requirements** for the minimum test surface.

At a minimum, deployment verification tests must cover:
- `GET /healthz` returns `200`
- `GET /readyz` returns `200`
- `POST /mcp` without a token returns `401`
- `POST /mcp` with a valid token returns a tool listing

```ts
describe('MyTool', () => {
  let tool: MyTool;
  let abilityService: jest.Mocked<AbilityService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MyTool,
        { provide: AbilityService, useValue: { can: jest.fn() } },
      ],
    }).compile();
    tool = module.get(MyTool);
    abilityService = module.get(AbilityService);
  });

  it('returns result for authorised user', async () => {
    abilityService.can.mockReturnValue(true);
    const result = await tool.myTool({ id: '...' }, mockContext, mockRequest);
    expect(result).toBe('expected');
  });

  it('throws ForbiddenException when CASL denies', async () => {
    abilityService.can.mockReturnValue(false);
    await expect(tool.myTool({ id: '...' }, mockContext, mockRequest))
      .rejects.toThrow(ForbiddenException);
  });

  it('throws ToolBusinessError for bad business state', async () => {
    abilityService.can.mockReturnValue(true);
    await expect(tool.myTool({ id: 'RESERVED' }, mockContext, mockRequest))
      .rejects.toThrow(ToolBusinessError);
  });

  it('skips CASL check in STDIO mode (no request)', async () => {
    const result = await tool.myTool({ id: '...' }, mockContext, undefined);
    expect(result).toBeDefined();
  });
});
```

---

## Mode: AUDIT

Use when the user asks to review, check, or validate an existing tool.

### AUDIT Checklist

- [ ] Step 1 — Read the tool file in full
- [ ] Step 2 — Run through the findings table below, line by line
- [ ] Step 3 — Classify each finding by severity
- [ ] Step 4 — Produce a Markdown report with file:line citations and concrete fixes
- [ ] Step 5 — If asked, generate corrected code for CRITICAL and HIGH findings

### Step A1 — Detect Transport Mode for Audit

Before running any findings checks, read `src/app.module.ts` and detect the mode exactly as
in Step 1b. Record it. The S-series findings below are mode-specific — applying stateless
findings to a stateful server (or vice versa) produces false positives.

### AUDIT Findings Table

**Tool & auth findings (apply in all modes)**

| Code | Severity | Description |
|---|---|---|
| B001 | CRITICAL | Tool has no `@ToolRoles()` and is not decorated with `@PublicTool()` — unauthenticated by default |
| B002 | CRITICAL | CASL ability check (`abilityService.can`) is absent from a write or sensitive tool handler |
| B003 | CRITICAL | `ToolBusinessError` is thrown for an auth failure that should be a guard-layer `ForbiddenException` |
| B004 | CRITICAL | Client bearer token or `techzone-token` forwarded to an upstream API |
| B005 | HIGH | Zod schema field missing `.describe('...')` |
| B006 | HIGH | String field with no `.max()` bound — susceptible to oversized input |
| B007 | HIGH | Tool not registered in `AppModule.providers` — silently absent from tool list |
| B008 | HIGH | Raw `Error` thrown instead of `ToolBusinessError` or a NestJS HTTP exception |
| B009 | HIGH | CASL check inside handler not guarded by `if (request && ...)` — will throw in STDIO mode |
| B010 | MEDIUM | Tool name does not follow `domain_verb_noun` convention |
| B011 | MEDIUM | No co-located `.spec.ts` file — tool is untested |
| B012 | MEDIUM | Spec file missing one or more of the four required test paths |
| B013 | LOW | `@Tool` `description` field is absent or a single word — not descriptive enough for an LLM |
| B014 | LOW | `z.any()` or `z.unknown()` used in schema — defeats ValidationPipe whitelist |

**CIO governance findings (apply in all modes)**

| Code | Severity | Description |
|---|---|---|
| G001 | HIGH | No evidence of APM registration as a Technical Service — required before gateway onboarding |
| G002 | HIGH | No evidence of CIO Path to Production approval — server cannot be onboarded to the gateway |
| G003 | MEDIUM | No `CODEOWNERS` file or ownership not attributed to the Enterprise Application team |
| G004 | HIGH | Tool depends on `context.reportProgress()` through the enterprise gateway — `GET /mcp` is blocked; notifications will not reach clients |
| G005 | CRITICAL | Tool crosses domain boundaries — belongs to a different domain than the server's declared scope |
| G006 | MEDIUM | Tool is a thin CRUD wrapper where an intent-based equivalent would be more appropriate |
| G007 | HIGH | Built-in `tools/list`, `resources/list`, or `prompts/list` handlers overridden in a way that hides tools from authorised users |
| G008 | HIGH | `Containerfile` or `tz-build.yml` removed or modified in a way that prevents CIO Cirrus deployment |

> **mTLS is not an audit finding for this template.** Transport encryption is terminated by
> the ContextForge MCP Gateway. No mTLS configuration is required or expected in the NestJS
> server code or deployment manifests — do not flag its absence.

**Tool naming findings (apply in all modes)**

| Code | Severity | Description |
|---|---|---|
| N001 | CRITICAL | Tool name starts with a digit or underscore — gateway will reject it |
| N002 | CRITICAL | Tool name contains a hyphen (`-`) — not permitted by CIO naming rules |
| N003 | CRITICAL | Tool name contains a period (`.`) — not permitted by CIO naming rules |
| N004 | CRITICAL | Tool name contains a colon (`:`) — not permitted by CIO naming rules |
| N005 | CRITICAL | Tool name contains a space or other special character — gateway will reject it |
| N006 | MEDIUM | Backend name with illegal characters exposed directly as tool name without translation |

**Observability findings (apply in all modes)**

| Code | Severity | Description |
|---|---|---|
| O001 | HIGH | No OTEL SDK initialisation found (`src/tracing.ts` absent, or not imported first in `main.ts`, or env vars missing) |
| O002 | HIGH | Outbound HTTP calls to backend services do not propagate `traceparent` header |
| O003 | CRITICAL | `OTEL_EXPORTER_OTLP_ENDPOINT` used with `/v1/traces` appended — causes double-pathing (`…/v1/traces/v1/traces`), silently failing all trace exports |
| O004 | CRITICAL | OTEL Client ID or Client Secret present in source code, manifests, or committed `.env` files — must be stored in a Kubernetes Secret |

**Test automation findings (apply in all modes)**

| Code | Severity | Description |
|---|---|---|
| T001 | HIGH | No deployment verification test file found — CIO requires these alongside unit tests |
| T002 | MEDIUM | Deployment verification tests do not cover the `401` unauthenticated rejection case |

**Stateless mode findings (apply only when `statelessMode: true`)**

| Code | Severity | Description |
|---|---|---|
| S001 | HIGH | `context.reportProgress()` called in a stateless server tool — call is a silent no-op and misleads readers |
| S002 | HIGH | `resources/subscribe` implemented — not supported in stateless mode, will never fire |
| S003 | MEDIUM | `sessionIdGenerator` present in `streamableHttp` config alongside `statelessMode: true` — has no effect |
| S004 | MEDIUM | `enableJsonResponse` absent or `false` in stateless mode — should be `true` for WAF compatibility |

**Stateful mode findings (apply only when `statelessMode: false`)**

| Code | Severity | Description |
|---|---|---|
| S005 | CRITICAL | `statelessMode: false` set but `sessionIdGenerator` is absent — server cannot issue session IDs |
| S006 | CRITICAL | `sessionIdGenerator` uses `Math.random()` or another non-CSPRNG source |
| S007 | HIGH | Session ID is logged anywhere in the codebase — treat session IDs as secrets |
| S008 | HIGH | `enableJsonResponse: true` set alongside `statelessMode: false` — SSE is disabled, progress notifications will not reach the client |
| S009 | CRITICAL | Multi-replica deployment with `statelessMode: false` and no shared session store — violates CIO mandatory standard #12; tool calls will fail when routed to a different pod |
| S010 | MEDIUM | Long-running tool (>2 s estimated) has no `context.reportProgress()` calls — missed opportunity for client feedback |

### Severity definitions

| Severity | Meaning |
|---|---|
| CRITICAL | Security gap or silent breakage — fix before any PR merge |
| HIGH | Correctness or safety issue — fix before merge |
| MEDIUM | Standards violation that degrades quality — should fix |
| LOW | Improvement that helps LLM accuracy — worth fixing |

---

## Hard Rules

These apply in both ADD and AUDIT mode. Never deviate from them.

1. **Never remove or bypass `TechzoneAuthGuard`** — it is registered globally in `McpModule.forRoot({ guards: [...] })`. Writing a guard that replaces it requires updating `app.module.ts` and the `references/security-layers.md` document simultaneously.

2. **Never use `z.any()` in a tool schema** — the `ValidationPipe` strips unknown properties, but `z.any()` defeats the purpose of having a schema at all.

3. **Never forward the `techzone-token` header or `req.user.token` to upstream services** — the JWT is scoped to this MCP server. If an upstream API needs auth, use a separate service-account token.

4. **Always test STDIO mode** — the `request` parameter is `undefined` in STDIO transport. Every handler that accesses `request` must guard with `if (request && ...)`.

5. **Always register new tools in `AppModule.providers`** — an unregistered `@Injectable()` tool silently disappears from the MCP tool list with no error.

6. **Never add `context.reportProgress()` to a tool without first confirming the server is in stateful mode** — in stateless mode the call silently does nothing, misleading any developer who reads the code later. If progress reporting is needed, switch the server to stateful mode first (see `references/stateful-vs-stateless.md`).

7. **Never add a new required env variable without updating `src/config/env.validation.ts`** — the Zod schema there is the single source of truth. An unvalidated env var can cause silent misconfiguration.

8. **Never use a tool name that contains hyphens, periods, colons, spaces, or starts with a digit** — the Enterprise MCP Gateway will reject the server. Translate backend names to CIO-compliant names and document the mapping.

9. **Never add a tool that crosses domain boundaries** — the CIO requires single-domain servers. A tool that belongs to a different domain must live in its own server.

10. **Never assume stateful SSE features work through the enterprise gateway** — the gateway blocks `GET /mcp`. Design tools to function correctly without mid-call progress notifications unless the server is accessed via a non-gateway path.

11. **Never deploy a stateful server across multiple replicas without a shared session store** — in-memory stateful mode is non-compliant with CIO standard #12 in clustered environments. If stateful mode is required with multiple replicas, a shared Redis session store is mandatory, not optional.

---

## Reference Files

- `references/security-layers.md` — The seven security layers of the ITZ template: what each layer does, what it rejects, and what agents must not break. **Always load.**
- `references/tool-patterns.md` — Tool file structure, Zod schema rules, CIO tool naming character rules and translation examples, authorisation patterns, error channel decision tree, AppModule registration, and testing conventions. Load when adding or auditing a tool.
- `references/stateful-vs-stateless.md` — Mode detection, capability constraints per mode, enforcement rules and audit findings for both stateless (S001–S004) and stateful (S005–S010) servers, session ID security, replica deployment requirements, GET /mcp gateway block impact, and the full changeset for switching modes. Load after detecting the mode in Step 1b.
- `references/governance.md` — CIO mandatory governance standards: APM registration, Path to Production approval, ownership, mTLS, GET /mcp gateway block, domain scoping, intent-based tool design, discoverability, OpenTelemetry tracing, deployment verification tests, and CIO Cirrus hosting. Load during Step 1c governance pre-flight.

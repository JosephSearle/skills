# Universal Reference — MCP Architecture Documentation

## C4 Model Principles for MCP Servers

### Core rules
- Document **stable architectural facts** — never volatile implementation details (handler logic, Zod field names, env var values, internal URLs)
- Every diagram answers a question for a specific audience; never draw a diagram the audience cannot act on
- Docs live in `docs/architecture/` in version control; they are updated as part of the development workflow
- Update triggers for MCP servers: new tool or resource added, transport changed, auth strategy changed, deployment target changed, MCP spec version bumped

### C4 level summary

| Level | Diagram type | Audience | Shows |
|-------|-------------|----------|-------|
| L1 — Context | C4Context | Business stakeholders | System and its external actors; no internal detail |
| L2 — Container | C4Container | Architects | Deployable / logical containers, their technologies, and interactions |
| L3 — Component | C4Component | Engineers | Components inside a single container |
| L4 — Code | (rarely used) | Engineers | Class/module level; skip unless the structure is genuinely non-obvious |

### AI Host vs human actor
The primary actor in an MCP server context diagram is the **AI Host** (Claude Desktop, claude.ai, an LLM application), not a human user. The AI Host is a software system — use `System(aiHost, ...)`, not `Person(aiHost, ...)`. A human developer or end user may appear as a secondary `Person` actor who configures or operates the Host.

### Mermaid syntax (Mermaid C4 native)

```mermaid
C4Context
  Person(name, "Label", "Description")
  System(name, "Label", "Description")
  System_Ext(name, "Label", "Description")
  System_Boundary(id, "Label") { ... }
  Rel(from, to, "Label", "Protocol")
  BiRel(from, to, "Label")
```

```mermaid
C4Container
  Container(name, "Label", "Tech", "Desc")
  ContainerDb(name, "Label", "Tech", "Desc")
  Container_Boundary(id, "Label") { ... }
```

```mermaid
C4Component
  Component(name, "Label", "Tech", "Desc")
  Container_Boundary(id, "Label") { ... }
```

### Diagram hard rules
- Mermaid **only** — never PlantUML (PlantUML does not render natively on GitHub)
- Never write an unclosed Mermaid fence block — a broken diagram is worse than none
- Never put technology detail (versions, env var names, JWT claims) inside diagram labels
- Never show implementation code (class names, function names) in C4 diagrams
- Always add `<!-- TODO: replace placeholders with actual names -->` above every stub diagram
- Placeholders use `<UPPERCASE_SNAKE_CASE>` format

---

## ADR Format (Nygard)

Architecture Decision Records capture the **why** behind significant decisions. They are immutable: once `Accepted`, never edited — superseded by a new ADR instead.

### Required fields

```markdown
# ADR <NUMBER>: <TITLE>

**Date:** <YYYY-MM-DD>
**Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-XXXX](XXXX-title.md)
**Deciders:** <names or roles>

## Context
<Problem, constraints, and forces. Focus on stable context — exclude transient details.>

## Decision
<State the decision in one or two sentences. Begin: "We decided to..." or "We will use...">

## Rationale
<Why chosen? Name alternatives considered and why each was rejected. Specify trade-offs.>

## Consequences
### Positive
### Negative
### Neutral / Risks

## Related Decisions
- Supersedes: (none)
- Superseded by: (none)
- Related: (none)
```

### Status lifecycle

```
Proposed → Accepted | Rejected
Accepted → Deprecated | Superseded by ADR-NNNN
```

### Naming
`NNNN-verb-noun-phrase.md` — zero-padded 4-digit numbers, kebab-case (e.g., `0002-use-streamable-http-transport.md`)

### Deserves ADR test
Would a future maintainer ask "why was this done this way?" — if yes, write an ADR.

### Anti-patterns
- Decision-only ADRs (no Context or Rationale)
- Post-hoc rationalisation without naming alternatives considered
- More than 6 unreviewed inferred stubs (noise, not clarity)
- Setting an inferred ADR to `Accepted` before human review

---

## MCP Spec 2025-11-25 — Key Architecture Facts

These facts must be represented accurately in architecture docs. Cite spec version when documenting them.

### Transport
- Two supported transports: **stdio** (local client-process) and **Streamable HTTP** (single `POST /mcp` endpoint)
- HTTP+SSE (the legacy two-endpoint pattern) was **deprecated 2025-03-26** — never document it as a current option
- Streamable HTTP responds with `application/json` (stateless) or `text/event-stream` (streaming/stateful)
- stdio: all logs MUST go to stderr — any non-MCP output to stdout corrupts the protocol

### Authorisation (remote servers)
- OAuth 2.1 is **mandatory** for remote MCP servers
- MCP servers are **OAuth Resource Servers**; they MUST implement **Protected Resource Metadata (RFC 9728)**
- Clients MUST implement **Resource Indicators (RFC 8707)** to bind tokens to audience
- **Token passthrough is explicitly forbidden** — servers must validate token audience before forwarding to downstream services
- Confused-deputy mitigations required for proxy servers: per-client consent, exact redirect-URI matching, `state` parameter validation

### Capability negotiation
- Capabilities declared in `initialize` response; only declared capabilities may be used
- Declare only what you implement — undeclared capabilities must not emit notifications
- Key capabilities: `tools`, `resources`, `prompts`, `logging`, `sampling`, `elicitation`
- `listChanged: true` on a capability means the server will emit `notifications/*/list_changed` when the list changes

### Session management (stateful servers)
- Session IDs MUST be cryptographically random (UUIDs or equivalent entropy)
- SHOULD be bound to user identity: `<user_sub>:<randomUUID()>` to prevent cross-session injection
- Client echoes `Mcp-Session-Id` header on every request after `initialize`

---

## Living Documentation Update Triggers

Update `docs/architecture/` (and create a new ADR stub) when any of the following occur:

| Event | Sections to update | ADR needed? |
|-------|-------------------|-------------|
| New tool, resource, or prompt added | 02, 03, 10-glossary | No (operational change) |
| Transport changed (stdio ↔ Streamable HTTP) | 01, 02, 05 | Yes |
| Auth strategy changed | 02, 03, 06 | Yes |
| Statefulness mode changed | 02, 04, 05, 07 | Yes |
| New external dependency added | 01, 08, 09 | Maybe (if architecturally significant) |
| Deployment target changed | 05 | Yes |
| MCP spec version bump | 06, 07, 08 | Yes (if breaking change) |
| New cross-cutting concern added | 06 | Maybe |

The `.checklist.md` file tracks items requiring human input after generation.

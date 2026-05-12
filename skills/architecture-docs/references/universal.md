# Universal Architecture Documentation Standards

Primary authorities: C4 Model (Simon Brown) | ADR (Michael Nygard) | arc42 | ISO/IEC/IEEE 42010:2022

---

## 1. What Architecture Documentation Is For

Architecture documentation exists to serve three specific tests. If your documentation cannot pass all three, it is incomplete:

1. **New engineer orientation** — A developer joining the team can understand system scope, key components, and their interactions without asking anyone.
2. **Stakeholder comprehension** — A non-technical stakeholder can understand what the system does, who uses it, and what risks exist, without reading code.
3. **Decision transparency** — A future maintainer can understand why the system is built the way it is, not just what it does. Trade-offs and constraints are visible.

Documentation that fails test 3 is the most common failure mode. Code shows the *what*; only documentation can preserve the *why*.

---

## 2. Core Principles

**Document WHY, not WHAT.**
The code already documents what. Architecture docs document the rationale, constraints, and trade-offs that shaped the design. If you find yourself re-describing what the code does, you are writing the wrong thing.

**Document stable facts, not volatile details.**
Architecture decisions change on a timescale of months to years. Implementation details change on a timescale of days. Document: component boundaries, communication patterns, technology choices, external dependencies, non-functional requirements. Never document: function signatures, field types, configuration values, internal URL paths.

**Documentation lives close to the code.**
Architecture docs belong in the repository, versioned with the code. Distance from code = documentation becomes an afterthought = documentation becomes stale.

**Every section has a stakeholder audience.**
Writing for "everyone" means writing for no one. Identify the primary audience for each section and tailor the level of detail and technical vocabulary accordingly:
- Business stakeholders: context, purpose, risks, external dependencies
- Architects: component structure, communication patterns, technology decisions
- Engineers: internal structure, data flows, cross-cutting concerns, NFRs
- Operations: deployment, scaling, monitoring, failure modes

**Incomplete documentation is better than wrong documentation.**
A section with honest stubs (`<TODO>`) is better than a section with confident but outdated content. Stale documentation actively misleads — a new engineer who acts on wrong architecture docs causes more damage than one who knows they need to ask.

---

## 3. Living Documentation Rules

Architecture documentation must be updated as part of the development workflow, not as a separate effort. Documentation that lives outside the development cycle will always be out of date.

**Mandatory update triggers:**
- Any structural change that affects an existing section (new service, removed service, new data store, changed communication protocol)
- Any new external dependency
- Any ADR that gets superseded
- Any change to deployment target or infrastructure topology
- Any change to a non-functional requirement or SLA

**Review cadence:**
Conduct a documentation review every 6–12 months. For each section: verify it still describes reality, update stubs, supersede outdated ADRs.

**What to document when:**
- *Before building*: Quality goals (07), technology decisions (08), ADRs for major choices
- *While building*: System context (01), container architecture (02), cross-cutting concerns (06)
- *After building*: Component view (03), data architecture (04), risks and debt (09)
- *Continuously*: Glossary (10), ADRs for each significant decision

---

## 4. What NOT to Document in Architecture Docs

These belong in other places and will make architecture docs stale:

| Don't put here | Put it here instead |
|---|---|
| API endpoint signatures and parameters | OpenAPI / Swagger specification |
| Field-level data types and schema | Database schema files, migration files |
| Function / method implementations | Code comments (inline) |
| Configuration values and environment variables | README or deployment runbook |
| Step-by-step setup instructions | README |
| Code style rules | Linter configuration, CONTRIBUTING.md |
| Dependency version pinning rationale | package.json, Dependabot config |
| Exact test case coverage | Test files, CI coverage reports |

**The test:** If the information would require an update every time a developer changes a few lines of code, it does not belong in architecture docs.

---

## 5. Diagram Guidelines

**Use native C4 Mermaid syntax for all C4 diagrams.**
Mermaid's `C4Context`, `C4Container`, and `C4Component` diagram types are semantically correct and render natively on GitHub, GitLab, and most modern developer tools. Do not use PlantUML or hand-drawn diagram exports.

**Use `flowchart LR` for data flow diagrams.**
Left-to-right orientation matches natural reading direction for flows. Top-down (`TB`) is reserved for containment hierarchies (deployment diagrams).

**Placeholder convention:** All unfilled values use `<UPPERCASE_SNAKE_CASE>`. This makes incomplete sections immediately visually obvious during review.

**Every diagram must render as valid Mermaid, even with placeholders.**
A broken diagram block is worse than no diagram — it signals that no one has reviewed the documentation. Generate stubs that parse correctly.

**Diagram labelling rules:**
- Always label relationship arrows with the protocol or action ("Uses", "Calls via REST", "Publishes to")
- Never leave relationship arrows unlabelled — an arrow without a label communicates nothing
- Use technology labels in Container diagrams (e.g., "Node.js 20", "PostgreSQL 16")
- Do not include technology detail in Context diagrams (stakeholders don't need it)

**What to show vs. omit (C4 level discipline):**

| Level | Show | Never show |
|---|---|---|
| Context (L1) | People, external software systems, the primary system as one box | Internal structure, technology choices, implementation detail |
| Container (L2) | Deployable units, data stores, communication protocols | Internal module structure, class-level detail, library choices within a container |
| Component (L3) | Major module groupings, key interfaces, data access components | All classes, helper utilities, test components, private methods |

---

## 6. Stakeholder Audience Guide

Use this to determine which sections to generate with the most depth and which can remain as lighter stubs initially.

| Audience | Primary sections | Secondary sections |
|---|---|---|
| Business / Product | 01 (context), 07 (quality goals) | 09 (risks), README |
| Solution Architect | 01 (context), 02 (containers), 08 (tech stack), ADRs | 05 (deployment), 07 (NFRs) |
| Backend Engineer | 02 (containers), 03 (components), 04 (data), 06 (concerns) | 08 (stack), 09 (debt) |
| Frontend Engineer | 01 (context), 02 (containers — API contracts) | 06 (auth, caching) |
| DevOps / Platform | 05 (deployment), 06 (observability), 07 (SLAs) | 02 (containers), 09 (risks) |
| Security Engineer | 06 (auth, error handling), 07 (security baseline) | 01 (context — external systems), ADRs |
| New Team Member | README (start here), 01 (context), 08 (tech stack), 10 (glossary) | All sections in order |

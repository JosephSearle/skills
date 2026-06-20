---
name: mcp-security-docs
description: >
  Generate and audit security documentation for MCP server projects. GENERATE mode creates the
  full gold-standard security doc set (SECURITY.md, security-insights.yml, STRIDE threat model,
  CVD process, incident response plan, and .well-known/security.txt) calibrated to the project's
  OSPS Baseline tier (L1–L3). AUDIT mode scores an existing project against OSPS Baseline DO/VM/SA
  controls, MCP-specific documentation requirements, and GitHub security tooling integration,
  emitting a severity-classified findings report. Triggers on: "add security docs", "create
  SECURITY.md", "generate threat model", "audit mcp security", "review security posture",
  "security documentation", "set up vulnerability disclosure", "add security-insights.yml".
  → For OAuth 2.1 / JWT runtime guard implementation use the mcp-auth-guardian skill.
  → For transport and injection hardening use the mcp-security-hardener skill.
---

# mcp-security-docs

## Core Philosophy

Security documentation reduces real risk only when it is accurate, current, and reflects the actual attack surface. Generic templates miss the threats that matter most for MCP servers — tool poisoning, prompt injection, and confused-deputy token passthrough — so any documentation set for an MCP project must explicitly address these controls rather than inheriting them from a pre-AI SECURITY.md boilerplate.

The OSPS Baseline (v2026.02.19) provides a tiered roadmap that prevents over-engineering: an L1 project needs a SECURITY.md and a private reporting channel, nothing more. Demanding L3 controls from a single-maintainer prototype wastes effort and produces placeholder-filled docs that erode trust. This skill matches output to the project's actual maturity tier.

MCP introduces a genuinely new documentation surface. Token passthrough is explicitly forbidden by the MCP spec. Tool descriptions can carry hidden instructions at connect time. Confused-deputy attacks exploit proxy servers that accept ambient authority. None of these appear in standard SECURITY.md templates — they must be documented in a dedicated MCP threat model section so that future maintainers and security reviewers can reason about mitigations.

---

## Mode: GENERATE

### GENERATE Checklist

- [ ] Step 1 — Detect project context
- [ ] Step 2 — Inventory existing security docs
- [ ] Step 3 — Determine OSPS Baseline tier
- [ ] Step 4 — Generate SECURITY.md
- [ ] Step 5 — Generate security-insights.yml (L2+)
- [ ] Step 6 — Generate docs/security/ subdocs (L2/L3)
- [ ] Step 7 — Generate .well-known/security.txt (deployed servers)
- [ ] Step 8 — Write all files and print guidance

---

### Step 1 — Detect project context

Always load:
  `references/universal.md`
  `references/mcp-specific.md`

Detect NestJS:
```
package.json contains "@nestjs/core" or "@nestjs/common"?
  └─ YES → load references/nestjs.md
  └─ NO  → skip nestjs reference
```

Detect MCP server:
```
Look for any of:
  - mcp.json at root
  - src/**/*.tool.ts files
  - imports of "@modelcontextprotocol/sdk" or "@nestjs/mcp" in source files
  └─ FOUND → confirmed MCP server; proceed
  └─ NOT FOUND → warn: "No MCP server indicators detected; generating generic security docs"
```

Detect hosting and deployment:
```
.github/ directory present?
  └─ YES → GitHub-hosted → include GitHub PVR instructions in output
  └─ NO  → note manual advisory process

Dockerfile or k8s YAML (*.yaml / *.yml with 'kind:' key) present?
  └─ YES → deployed server → generate .well-known/security.txt (Step 7)
  └─ NO  → skip Step 7
```

Estimate OSPS tier signal:
```
Count maintainers via: package.json contributors array / CODEOWNERS / .github/CODEOWNERS
  └─ 1 maintainer, no CODEOWNERS → tier signal: L1
  └─ ≥2 maintainers OR CODEOWNERS present → tier signal: L2
  └─ Large consistent user base indicators (npm weekly downloads badge, CNCF affiliation) → tier signal: L3
```

---

### Step 2 — Inventory existing security docs

Check the following paths and note present/missing status for each:

| Path | Required by | Status |
|------|-------------|--------|
| `SECURITY.md` | OSPS VM-02.01 (L1) | ? |
| `.github/SECURITY.md` | OSPS VM-02.01 (L1) | ? |
| `docs/SECURITY.md` | OSPS VM-02.01 (L1) | ? |
| `security-insights.yml` | OSPS SA-03.01 (L2) | ? |
| `.github/security-insights.yml` | OSPS SA-03.01 (L2) | ? |
| `docs/security/threat-model.md` | OSPS SA-03.02 (L3) | ? |
| `docs/security/vulnerability-disclosure.md` | OSPS VM-01.01 (L2) | ? |
| `docs/security/incident-response.md` | CIS Control 17 (L3) | ? |
| `.well-known/security.txt` | RFC 9116 (deployed) | ? |

For each found file, note what content sections are present vs. missing (checked against the required section set in Steps 4–7).

```
All P0 docs present AND content complete?
  └─ YES → inform user; offer to run AUDIT mode instead
  └─ NO  → continue to Step 3
```

---

### Step 3 — Determine OSPS Baseline tier

Apply the tier signals from Step 1:

```
Tier signal is L1:
  └─ Generate: SECURITY.md only
  └─ Skip: security-insights.yml, docs/security/ subdocs

Tier signal is L2:
  └─ Generate: SECURITY.md + security-insights.yml
  └─ Generate: docs/security/vulnerability-disclosure.md
  └─ Generate: docs/security/threat-model.md
  └─ Skip: incident-response.md, attack-surface.md

Tier signal is L3:
  └─ Generate all of the above PLUS:
  └─ docs/security/incident-response.md
  └─ docs/security/attack-surface.md (stub)
```

State the determined tier to the user before proceeding.

---

### Step 4 — Generate SECURITY.md

Emit from `assets/SECURITY.md.template`.

Populate the following sections — replace all `<PLACEHOLDER: ...>` markers with project-specific values where known, or leave the marker intact for the user to fill:

**Required sections (all tiers):**

1. **Supported Versions** — table of release lines and support status
2. **Reporting a Vulnerability** — private reporting channel (GitHub PVR URL if GitHub-hosted, else email)
3. **Response Timeline** — acknowledge within 5 business days; detailed response within 10 days
4. **Coordinated Disclosure Policy** — embargo period (≤90 days); when advisory is published; credit policy
5. **Scope** — what is in scope (this MCP server's transport, tools, auth); what is out of scope (dependencies, host OS)
6. **MCP Threat Model Summary** — tool poisoning, prompt injection, OAuth token audience enforcement, confused-deputy; link to `docs/security/threat-model.md` if generated

**If NestJS detected:** add to Scope section: "Runtime hardening includes Helmet (HTTP headers), CORS allowlist, `@nestjs/throttler` rate limiting, and ValidationPipe input validation."

**Write to:** `SECURITY.md` (repo root, preferred) or `.github/SECURITY.md` if root is cluttered.

---

### Step 5 — Generate security-insights.yml (L2+)

Skip if tier is L1.

Emit from `assets/security-insights.template.yml`.

Required field values to populate:

- `header.schema-version`: `"2.2.0"` (must be lowercase filename; v1.x uppercase is deprecated)
- `header.project-url`: `<PLACEHOLDER: https://github.com/org/repo>`
- `header.changelog-url`: `<PLACEHOLDER: https://github.com/org/repo/blob/main/CHANGELOG.md>`
- `project.vulnerability-reporting.reports-accepted`: `true`
- `project.vulnerability-reporting.bug-bounty-available`: `false` (unless confirmed)
- `project.vulnerability-reporting.policy`: link to SECURITY.md
- `repository.security.assessments`: at minimum an empty array `[]` (required field; fill with assessment URLs when available)
- `repository.documentation.security-policy`: link to SECURITY.md

**Write to:** `security-insights.yml` (repo root).

---

### Step 6 — Generate docs/security/ subdocs (L2+)

Skip if tier is L1.

Create the `docs/security/` directory if absent.

**L2 — vulnerability-disclosure.md:**
Emit from `assets/vulnerability-disclosure.template.md`.
Content: ISO 29147/30111-aligned CVD lifecycle — intake → acknowledgement (≤5 days) → verification → remediation development → coordinated disclosure (embargo ≤90 days) → advisory publication.
**Write to:** `docs/security/vulnerability-disclosure.md`

**L2 — threat-model.md:**
Emit from `assets/threat-model.template.md`.
Content: STRIDE analysis for MCP components (Host/Client, MCP Server, Transport, Tool Execution), plus MCP-specific attack section (tool poisoning, prompt injection, confused-deputy/token-passthrough, supply chain). Include a mitigations column per threat. Reference `references/mcp-specific.md` for attack details.
**Write to:** `docs/security/threat-model.md`

**L3 — incident-response.md:**
Emit from `assets/incident-response.template.md`.
Content: CIS Control 17 IR lifecycle (detection → triage → containment → eradication → recovery → blameless retrospective). Include communication templates and escalation paths.
**Write to:** `docs/security/incident-response.md`

**L3 — attack-surface.md (stub):**
Generate a minimal stub with headings: Entry Points, Trust Boundaries, Data Flows, High-Value Assets. Mark all sections `<PLACEHOLDER: complete during first security assessment>`.
**Write to:** `docs/security/attack-surface.md`

---

### Step 7 — Generate .well-known/security.txt (deployed servers only)

Skip if no deployment artifacts detected in Step 1.

Emit from `assets/security.txt.template`.

Required RFC 9116 fields:
- `Contact`: private reporting URL or security email
- `Policy`: URL to SECURITY.md (raw GitHub URL or hosted URL)
- `Expires`: exactly 1 year from today in RFC 3339 format (e.g., `2027-06-09T00:00:00Z`)
- `Preferred-Languages`: `en`

**Write to:** `.well-known/security.txt`

Note: this file must be served over HTTPS at `/.well-known/security.txt` by the running MCP server. Add a NestJS static asset or route to serve it.

---

### Step 8 — Write all files and print guidance

List every file written:

```
Files written:
  SECURITY.md                                    (P0 — OSPS VM-02.01)
  security-insights.yml                          (P1 — OSPS SA-03.01)   [L2+ only]
  docs/security/vulnerability-disclosure.md      (P1 — OSPS VM-01.01)   [L2+ only]
  docs/security/threat-model.md                  (P1 — OSPS SA-03.02)   [L2+ only]
  docs/security/incident-response.md             (P2 — CIS Control 17)  [L3 only]
  docs/security/attack-surface.md                (P2 — OSPS SA-03.02)   [L3 only]
  .well-known/security.txt                       (P1 — RFC 9116)        [deployed only]
```

Print next-steps checklist:

```
Next steps:
  [ ] Enable GitHub Private Vulnerability Reporting:
      GitHub repo → Settings → Security → Private vulnerability reporting → Enable
  [ ] Review all <PLACEHOLDER: ...> markers across generated files and fill with real values
  [ ] Fill supported versions table in SECURITY.md with your actual release lines
  [ ] Replace threat model component names with your actual service names
  [ ] Register security contacts in security-insights.yml → repository.security.champions
  [ ] Run OpenSSF Scorecard to verify Security-Policy score:
      docker run -e GITHUB_AUTH_TOKEN=<token> gcr.io/openssf/scorecard:stable --repo=<github-url>
  [ ] Serve .well-known/security.txt from your running MCP server (if deployed)
  [ ] Re-run AUDIT mode in 90 days or after any significant architecture change
```

---

## Mode: AUDIT

### AUDIT Checklist

- [ ] Step A1 — Run audit script against project root
- [ ] Step A2 — Score against OSPS Baseline DO/VM/SA controls
- [ ] Step A3 — Score MCP-specific documentation controls
- [ ] Step A4 — Score GitHub security tooling integration
- [ ] Step A5 — Emit findings report with remediation guidance

---

### Step A1 — Run audit script

```
npx ts-node scripts/audit-security-docs.ts <project-root>
```

The script outputs NDJSON findings to stdout (one JSON object per line) followed by a Markdown summary. Parse the NDJSON findings and carry them into Steps A2–A4 to supplement manual checks.

If `ts-node` is unavailable, perform all checks manually using the controls in Steps A2–A4.

Always load:
  `references/universal.md`
  `references/mcp-specific.md`

---

### Step A2 — Score OSPS Baseline DO/VM/SA controls

Check each control and assign a finding for each gap:

**Documentation (DO) family:**

| Control | Requirement | Check |
|---------|-------------|-------|
| DO-02.01 (L1) | Defect/vulnerability reporting guide exists | SECURITY.md or docs/security/vulnerability-disclosure.md present |
| DO-06.01 (L2) | Dependency management description | SECURITY.md or README describes dependency update policy |
| VM-02.01 (L1) | Security contacts published | SECURITY.md has a reporting section with contact method |
| VM-01.01 (L2) | CVD policy with response timeframe | SECURITY.md states explicit SLA (days) |
| VM-03.01 (L2) | Private vulnerability reporting channel | GitHub PVR enabled OR dedicated security email documented |
| VM-04.01 (L2) | Public vulnerability disclosures | SECURITY.md or changelog documents disclosed CVEs |
| SA-01.01 (L2) | Design documentation exists | docs/architecture/ or equivalent present |
| SA-02.01 (L2) | External interface descriptions | MCP tool definitions or API docs exist |
| SA-03.01 (L2) | Security assessment documented | security-insights.yml has assessments field |
| SA-03.02 (L3) | Threat model + attack surface | docs/security/threat-model.md AND docs/security/attack-surface.md present |

---

### Step A3 — Score MCP-specific documentation controls

These controls have no equivalent in pre-AI standards frameworks. A missing control is `[CRITICAL]`.

| Code | Check | Pass condition |
|------|-------|---------------|
| MCP-01 | MCP threat model summary in SECURITY.md | SECURITY.md contains section referencing tool poisoning |
| MCP-02 | Token passthrough policy documented | SECURITY.md or threat-model.md states "token passthrough is forbidden" |
| MCP-03 | OAuth 2.1 / RFC 8707 audience binding documented | threat-model.md or README documents aud claim enforcement |
| MCP-04 | Tool poisoning mitigations documented | threat-model.md describes strict JSON schema validation, egress controls |
| MCP-05 | Prompt injection mitigations documented | threat-model.md describes input sanitisation for tool responses |
| MCP-06 | Confused-deputy mitigations documented | threat-model.md describes per-client consent and redirect-URI matching |
| MCP-07 | Audit logging policy documented | threat-model.md or README states state-changing tool calls are logged |
| MCP-08 | Dev tooling authentication documented | SECURITY.md notes MCP Inspector auth requirement (ref: CVE-2025-49596) |

---

### Step A4 — Score GitHub security tooling integration

| Check | Pass condition |
|-------|---------------|
| GitHub PVR enabled | SECURITY.md contains "github.com/<org>/<repo>/security/advisories/new" link |
| Security Advisory process linked | SECURITY.md references GitHub Security Advisories |
| security-insights.yml valid schema version | File contains `schema-version: "2.2.0"` (lowercase filename, v2.x) |
| security-insights.yml vulnerability-reporting complete | `reports-accepted: true` and `policy` URL present |
| OpenSSF Scorecard badge | README.md contains a Scorecard badge or link |

---

### Step A5 — Emit findings report

Output a findings table using the AUDIT Findings Table format. Then provide remediation guidance for each finding.

**Severity definitions:**
- `[CRITICAL]` — Missing P0 doc OR MCP-specific auth/token control undocumented
- `[HIGH]` — OSPS L1 gap (any project should have this)
- `[MEDIUM]` — OSPS L2 gap (maturing project should have this)
- `[LOW]` — OSPS L3 gap or best-practice recommendation

### AUDIT Findings Table

| Code | Severity | Control | File | Finding | Fix |
|------|----------|---------|------|---------|-----|
| _populated from Steps A2–A4_ | | | | | |

After the table, for each `[CRITICAL]` and `[HIGH]` finding, provide:
- One-paragraph explanation of why the gap matters
- Exact remediation action (e.g., "Run GENERATE mode to produce this file" or "Add the following section to SECURITY.md:")
- Reference to the controlling standard

**AUDIT Example 1 — All P0 docs present, L2 gaps:**
```
Findings: 0 CRITICAL, 0 HIGH, 3 MEDIUM, 1 LOW
MEDIUM SEC-005 | OSPS SA-03.01 | security-insights.yml missing
MEDIUM SEC-008 | OSPS VM-01.01 | SECURITY.md has no explicit SLA (days)
MEDIUM MCP-02  | MCP spec      | Token passthrough policy not documented
LOW    MCP-08  | CVE-2025-49596 | No mention of MCP Inspector auth requirement
Recommendation: Run GENERATE mode at L2 to produce security-insights.yml and fill SECURITY.md gaps.
```

**AUDIT Example 2 — Bare project, no security docs:**
```
Findings: 3 CRITICAL, 4 HIGH, 0 MEDIUM, 0 LOW
CRITICAL SEC-001 | OSPS VM-02.01  | SECURITY.md missing entirely
CRITICAL MCP-01  | MCP spec       | No MCP threat model documented anywhere
CRITICAL MCP-03  | MCP spec/RFC8707 | OAuth audience binding undocumented
HIGH     SEC-002 | OSPS VM-03.01  | No private vulnerability reporting channel
...
Recommendation: Run GENERATE mode at L1 immediately; L2 within 30 days.
```

---

## Reference Files

- `references/universal.md` — OSPS Baseline v2026.02.19 DO/VM/SA control table; OpenSSF Scorecard checks; GitHub PVR and Security Advisories guide; ISO/IEC 29147 + 30111 CVD lifecycle; NIST SSDF RV.1–RV.3 requirements; RFC 9116 security.txt fields
- `references/mcp-specific.md` — MCP spec (2025-11-25) OAuth/token rules; OWASP Top 10 for LLM Applications 2025; OWASP Top 10 for Agentic Applications 2025; tool poisoning attack and mitigations; confused-deputy mitigations; CVE-2025-49596; audit logging requirements
- `references/nestjs.md` — NestJS runtime security controls (Helmet, CORS, throttler, ValidationPipe) — load only when NestJS detected; use as mitigation citations inside threat model, not as documentation structure standards

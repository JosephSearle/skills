---
name: security-baseline
description: >
  Personal security baseline — the always-loaded foundation covering
  secrets handling, dependency/supply-chain hygiene, infrastructure
  exposure, and vulnerability response, aligned to NIST SSDF's four
  domains. Applies to every software project regardless of domain — the
  security-api, security-llm, security-mcp, and security-agent skills
  layer on top of this and assume it's already loaded, they don't repeat
  it. Use this skill whenever drafting a spec.md or architecture review
  (e.g. as part of an sdlc-design flow), scoping a new project's security
  posture, or whenever the user asks for a security review, threat check,
  or policy check on a project — even if they don't name this skill
  directly. This skill is intentionally generic and stack-agnostic: it
  does not assume any particular cloud provider, secrets manager,
  database, or observability tool.
summary: Always-loaded, stack-agnostic security baseline covering secrets handling, dependency/supply-chain hygiene, infrastructure exposure, data handling, and vulnerability response, aligned to NIST SSDF's four domains; walks a project's design against each section, asking about the actual stack rather than assuming one, and flags any gap as a named area of concern rather than silently resolving or designing around it -- the foundation the security-api, security-llm, security-mcp, and security-agent skills all layer on top of.
---

# Security Baseline

Applies to all software projects, always, regardless of persona or
domain. Domain-specific skills (security-api, security-llm, security-mcp,
security-agent) assume this baseline is already loaded and don't repeat
its content — if a project spans multiple domains, load this skill plus
whichever domain skills apply.

This skill is intentionally generic. Before applying any section below to
a specific project, ask the user what their actual services, hosting
targets, and observability tooling are — never assume a stack, vendor, or
product. The point of this file is to be equally correct whether the
project is a solo side project, a startup's first API, or a large
org's internal platform.

## 1. Secrets and credentials (Protect the Software)
- No credentials, API keys, tokens, or connection strings are ever
  committed to a repo — in code, config, commit history, or example
  files with real values left in.
- Secrets live in environment variables or a secrets manager appropriate
  to the deployment target. Ask the user what that target is (a cloud
  provider's secrets manager, a self-hosted vault, a local keychain,
  a CI/CD platform's secret store) — don't assume one.
- Any component that needs a credential receives it at runtime via
  injection — never hardcoded into a definition, config, or skill/tool
  file.
- Prefer short-lived, scoped credentials over long-lived static ones
  wherever the target system supports it.

## 2. Dependency and supply-chain hygiene (Produce Well-Secured Software)
- New dependencies (npm, pip, crates, go modules, or whatever the
  project's ecosystem is) are pinned to specific versions for anything
  deployed, not left on floating ranges.
- Prefer well-maintained, widely-used packages over obscure ones for
  anything touching auth, crypto, or network boundaries.
- Treat any third-party executable code — including MCP servers, CLI
  tools, browser extensions, and pre-built agent packages — as an
  untrusted dependency until vetted, same as a library: know what it does
  before running it with real credentials or production data.

## 3. Infrastructure and network exposure (Protect the Software)
- Ask the user which services this project self-hosts or depends on (a
  database, a vector store, an internal gateway, a model-serving
  endpoint, a message queue — whatever applies) before assessing
  exposure; don't assume a specific product or vendor.
- Any self-hosted service is internal-only by default — not exposed to
  the public internet without authentication in front of it.
- Any service given external exposure is a deliberate, logged decision
  gated behind an auth layer — never a silent default.

## 4. Data handling (Prepare the Organization)
- No personally identifiable information (PII) is stored, logged, or
  passed to a third-party model/API without an explicit, stated reason,
  and the data is scoped/minimized to what's actually needed.
- If the project has observability, logging, or tracing (whatever the
  user's actual tooling is), confirm trace and log payloads don't capture
  raw secrets or PII — redact or exclude before logging, rather than
  assuming a particular tool's defaults are already safe.

## 5. Vulnerability response (Respond to Vulnerabilities)
- Known vulnerabilities in dependencies get triaged, not silently
  ignored — check for a patched version before accepting a known CVE as
  a permanent risk.
- Incidents (a leaked secret, an over-broad permission discovered in
  production, a dependency with an active exploit) get documented, not
  just quietly fixed — the goal is catching the *pattern* next time, not
  just patching this one instance.

## How to apply this skill
1. Ask what the project's actual stack, hosting target, and
   observability tooling are if not already known — never assume.
2. Walk through sections 1–5 against the project's actual design or
   architecture.
3. Any point where the design doesn't meet a rule above — flag it as an
   explicit "area of concern," naming which section it violates. Do not
   silently resolve it or design around it.
4. If the caller (e.g. an sdlc-design flow) has an "areas of concern"
   section in its output, put flagged items there rather than burying
   them in prose the reviewer has to hunt through.

---
name: security-api
description: >
  API security policy skill, aligned to the OWASP API Security Top 10
  (2023) — Broken Object Level Authorization, Broken Authentication,
  Broken Object Property Level Authorization, Unrestricted Resource
  Consumption, Broken Function Level Authorization, Unrestricted Access
  to Sensitive Business Flows, SSRF, Security Misconfiguration, Improper
  Inventory Management, and Unsafe Consumption of APIs. Use this skill
  whenever the project exposes or consumes an API (REST, GraphQL, or
  otherwise) — designing a new endpoint, reviewing existing API
  architecture, drafting a spec.md that includes an API surface, or
  whenever the user asks for an API security review, even if they don't
  name this skill directly. This skill assumes security-baseline is
  already loaded and does not repeat its content (secrets, dependency
  hygiene, infra exposure) — it covers only what's specific to the API
  layer. Stack-agnostic: does not assume REST vs GraphQL, or any
  particular framework or gateway.
summary: API security policy aligned to the OWASP API Security Top 10 (2023) -- BOLA, broken authentication, BOPLA, unrestricted resource consumption, BFLA, unrestricted access to sensitive business flows, SSRF, security misconfiguration, improper inventory management, and unsafe consumption of third-party APIs; walks a project's actual API design against all ten, asking what kind of API it is and who calls it rather than assuming a framework or gateway, and flags any gap as a named area of concern rather than silently resolving it -- assumes security-baseline is already loaded and covers only what's specific to the API layer.
---

# API Security

Assumes security-baseline is already loaded. This skill covers only
what's specific to the API layer — authorization, resource limits, and
API-specific configuration — not secrets, dependencies, or general infra,
which baseline already handles.

Before applying this, ask what kind of API it is (REST, GraphQL, RPC),
what it does, and who's expected to call it — don't assume a framework,
gateway, or auth provider.

## 1. Object-level authorization (API1:2023 — BOLA)
- Every endpoint that takes an object ID must check that the calling
  user actually owns or has rights to that specific object — not just
  that they're logged in.
- The most common and damaging API flaw is exactly this: a user changes
  an ID in the request and reads or modifies someone else's object
  because only authentication was checked, not per-object authorization.
- Flag any endpoint accepting a user-supplied ID with no visible
  per-request ownership check.
- This is independent of function-level access (section 5): a caller can
  correctly pass a role/function check and still lack ownership of the
  specific object requested. Both checks are required, neither implies
  the other.

## 2. Authentication (API2:2023)
- Identify how the API authenticates callers (tokens, API keys, mTLS,
  session cookies — ask, don't assume) and confirm the mechanism is
  actually enforced on every endpoint, not just the ones that "look"
  sensitive.
- If tokens are JWTs: confirm the signature is verified against a
  trusted key on every request — never trust a claim in the payload
  (e.g. a role field) just because it's present. A token with
  `"alg": "none"` or an unverified signature lets an attacker hand-write
  any claims they want.
- Confirm tokens are short-lived with a refresh mechanism, not
  long-lived or non-expiring — a stolen long-lived token gives an
  attacker an indefinite window, since (unlike a server-side session)
  a self-contained token often can't be revoked before it expires.

## 3. Object property-level authorization (API3:2023 — BOPLA)
- Read side: an endpoint should only return the specific fields a caller
  needs, not the full underlying record by default — extra fields
  returned "because the object already has them" (password hashes,
  internal notes, other users' contact info) widen every future attack
  surface, not just the immediate one.
- Write side: an endpoint should only accept a specific, allowlisted set
  of fields per request — accepting and saving the entire request body
  is mass assignment, and lets a caller set fields they were never
  meant to touch (e.g. their own `role` or `is_verified` field).
- This is independent of object-level authorization (section 1): a
  caller can legitimately own the object and still not be allowed to
  see or set every field on it.

## 4. Resource consumption (API4:2023)
- Every endpoint should have limits on request rate, payload size,
  response size (page size / result limit), and execution time — an API
  with no such limits is exploitable for denial-of-service or, on
  metered cloud infrastructure, "denial of wallet" (the attacker's cost
  to the business scales with usage, not just uptime).
- There's no universal safe number for a limit (e.g. page size) — it
  depends on the endpoint's purpose, per-row weight, and who's calling
  it. The rule is that someone made a deliberate decision and enforced
  it, not what the specific number is.
- Prefer clamping over-limit requests (silently cap at the max) over
  erroring, unless the caller needs to know their request was truncated.
- Flag any endpoint with no rate limiting, no cap on a `limit`/page-size
  field, or no timeout on long-running operations.

## 5. Function-level authorization (API5:2023 — BFLA)
- Distinct from object-level (section 1): this checks whether the
  caller's role is allowed to invoke this *function* at all, before any
  object ID or request body is even considered.
- A role/permission check must happen server-side, explicitly, on every
  privileged endpoint — never rely on a client UI simply not showing a
  button as the access control.
- Flag any endpoint reachable by a lower-privilege role that should be
  restricted to a higher one, regardless of what object it operates on.

## 6. Sensitive business flows (API6:2023)
- Distinct from every other section: no single request needs to look
  wrong for this to be exploited. The risk shows up only in aggregate,
  across many accounts/requests, targeting a flow that's valuable to
  automate at scale (scarce inventory, money, promotional credit,
  influence over other users/content).
- Ask which flows in this specific business would be profitable to hit
  thousands of times in a row (ticket/inventory purchases, account
  creation, coupon redemption, referral bonuses, review/comment
  posting) — there's no generic technical checklist here, it depends on
  what the business actually does.
- Defenses are flow-level, not just per-request: rate limiting scoped to
  the flow across accounts (not just per account), proof-of-humanity at
  signup, anomaly detection on velocity, queue-based access for
  high-demand events.

## 7. Server-side request forgery (API7:2023 — SSRF)
- Any endpoint that has the server fetch a remote resource based on a
  user-supplied URL or identifier is a flag — the server's own trusted
  network position can reach internal addresses (cloud metadata
  endpoints, internal services) the original caller never could reach
  directly.
- Fix with an allowlist of approved destinations, not a blocklist of
  known-dangerous ones — blocklists are easy to route around (alternate
  IP encodings, DNS tricks, redirects) and can't anticipate every
  internal address that might exist.
- The check must apply to every redirect hop the fetch follows, not just
  the URL originally submitted — a legitimate-looking public URL can
  itself redirect to an internal address, bypassing an upfront-only
  check.

## 8. Security misconfiguration (API8:2023)
- Different in kind from sections 1–7: this isn't a missing or broken
  check someone wrote — it's a permissive default that was never
  actively, deliberately hardened. The fix pattern is a review of every
  configurable surface, not a bug patch.
- Verbose errors in production (stack traces, internal file paths,
  connection strings, credentials) hand an attacker a map of internal
  architecture even with no direct exploit — return a generic error to
  the client, log the detail internally only.
- Other common instances: default credentials never rotated, permissive
  CORS (e.g. `Access-Control-Allow-Origin: *`), unnecessary HTTP methods
  left enabled on an endpoint that only needs one.

## 9. Inventory management (API9:2023)
- You cannot protect an endpoint nobody remembers exists — ask whether
  old API versions, staging/debug environments, or abandoned
  partner/webhook integrations are still reachable alongside the current
  ones.
- A fix applied to a current version does nothing for an old,
  undocumented version still running the vulnerable logic — patching
  requires knowing every place that logic lives, not just the one
  everyone's currently using.
- Flag any project with no clear, current, actively maintained list of
  what endpoints/versions/environments exist and are still supported.

## 10. Unsafe consumption of third-party APIs (API10:2023)
- The mirror image of everything else in this skill: data returned from
  a trusted third-party or partner API is not automatically safe, and
  needs the same scrutiny as user input — "trusted" is not the same as
  "safe."
- Flag any integration that follows a link/redirect embedded in a
  partner response, pipes partner response data directly into a query
  or command, or deserializes a partner's response into objects/code
  without validating its structure first.
- If the partner is ever compromised or manipulated, unvalidated trust
  in their response becomes an entry point into your own system — often
  via the same SSRF mechanism as section 7, just triggered by response
  data instead of a direct user request.

## How to apply this skill
1. Confirm security-baseline has already been applied — don't duplicate
   secrets/infra/dependency checks here.
2. Ask what kind of API this is and who calls it, if not already known.
3. Walk sections 1–10 against the project's actual endpoints/design.
4. Flag violations as explicit "areas of concern," naming which
   numbered section they violate — don't silently resolve or design
   around them.

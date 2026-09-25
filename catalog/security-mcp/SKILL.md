---
name: security-mcp
description: >
  MCP (Model Context Protocol) security policy skill, aligned to the
  OWASP MCP Top 10: Token Mismanagement & Secret Exposure, Privilege
  Escalation via Scope Creep, Tool Poisoning, Software Supply Chain
  Attacks, Command Injection & Execution, Prompt Injection via
  Contextual Payloads, Insufficient Authentication & Authorization, Lack
  of Audit and Telemetry, Shadow MCP Servers, and Context Injection &
  Over-Sharing. Use whenever a project builds, exposes, or connects to
  an MCP server or gateway — designing tool definitions, reviewing an
  MCP-based architecture, drafting a spec.md involving MCP, or whenever
  the user asks for an MCP security review, even unnamed. Assumes
  security-baseline is already loaded; load alongside security-llm
  (prompt injection, output handling) and security-agent (tool scoping,
  autonomy) for a full picture, since MCP sits at the tool-calling layer
  those two skills also touch. Stack-agnostic: no assumed transport
  (stdio/HTTP), gateway product, or specific servers.
summary: MCP (Model Context Protocol) security policy aligned to the OWASP MCP Top 10 -- token mismanagement & secret exposure, privilege escalation via scope creep, tool poisoning, software supply chain attacks, command injection & execution, prompt injection via contextual payloads, insufficient authentication & authorization, lack of audit and telemetry, shadow MCP servers, and context injection & over-sharing; cross-references the security-baseline/security-api/security-llm/security-agent principle each entry extends where one exists, and gives full treatment to the genuinely MCP-native risks (tool poisoning, the "lethal trifecta" of context injection) that have no equivalent elsewhere -- assumes security-baseline is already loaded, loads alongside security-llm and security-agent for a full picture.
---

# MCP Security

Assumes security-baseline is already loaded. Many entries in this skill
are the same underlying principle as an entry in security-api,
security-llm, or security-baseline, reappearing in MCP's specific
client-server-tool architecture (Host → Client → Server(s) → Tools).
Where that's true, this file says so explicitly rather than re-deriving
the concept — apply the cross-referenced section's fix, adapted to the
MCP context described here. A smaller number of entries are genuinely
new mechanisms specific to MCP's architecture (multiple servers sharing
one context, tool definitions treated as trusted instructions); those
get full treatment below.

Before applying this, ask what transport is used (stdio/local vs.
HTTP/remote), how many servers are connected, and whether the project
is the MCP server, the client/host, or both — don't assume.

## 1. Token mismanagement & secret exposure (MCP01)
- Extends security-baseline section 1 (secrets never hardcoded, always
  injected at runtime) with an MCP-specific requirement: credentials
  used by an MCP server must be scoped **per user**, not shared across a
  team, even if properly stored and correctly scoped otherwise.
- A shared credential makes every action taken through the server
  unattributable to a specific person — when an incident happens, the
  audit log can only say "the shared token did it," with no way to trace
  which session or prompt actually triggered it.
- Prefer short-lived, per-user tokens minted for the specific session
  over long-lived shared or service-wide credentials.

## 2. Privilege escalation via scope creep (MCP02)
- Extends the Principle of Least Privilege (security-agent /
  security-llm section 6) with a requirement least-privilege alone
  doesn't cover: **scope expiry and periodic review**. A scope that was
  genuinely minimal at setup can still become dangerous months later if
  the server's usage grows and nobody revisits what it was ever granted.
- Flag any long-running MCP server/credential with no expiry date and no
  scheduled access review — "minimal at grant time" is not sufficient on
  its own.

## 3. Tool poisoning (MCP03)
- Tool descriptions and parameter schemas are typically treated as
  trusted instructions by the model, the same as a system prompt — even
  though they originate from a third-party server the user didn't
  author. This is the signature MCP-specific risk category.
- Three sub-techniques, each requiring a distinct check:
  - **Rug pulls**: a tool's description or behavior changes *after* a
    user already reviewed and approved it. A one-time review at install
    provides no protection against this — pin and re-verify the tool
    definition on every use (or on a defined re-check interval), and
    treat any change as requiring re-approval, the same discipline as
    detecting a supply-chain package that changed after audit.
  - **Schema poisoning**: the parameter schema itself (not just
    free-text description) is corrupted so the agent passes data to the
    wrong handler or an unintended destination.
  - **Tool shadowing**: a malicious or duplicate tool is named/described
    to intercept calls meant for a different, legitimate tool.

## 4. Software supply chain attacks (MCP04)
- Identical discipline to security-baseline section 2 and security-llm
  section 3 — an MCP server is a third-party executable artifact, same
  trust class as an npm package or a model checkpoint. No new concept:
  vet the server's source and maintainer before connecting it, same as
  any other dependency.

## 5. Command injection & execution (MCP05)
- Identical vulnerability class to SQL injection (API-list) and XSS
  (security-llm section 5) — a different sink (a shell/subprocess)
  rather than a database or browser. Any MCP tool that builds a shell
  command by concatenating model- or user-supplied input is vulnerable.
- Fix identically: never string-concatenate untrusted input into a
  command; use safe, parameterized execution (argument arrays, not shell
  string interpolation) for any tool that shells out.

## 6. Prompt injection via contextual payloads (MCP06)
- The same architectural problem as security-llm section 1, with an
  MCP-specific expansion: the injection vector isn't only document
  content — it's also **tool outputs** (a tool's return value re-enters
  the model's context) and **tool descriptions/metadata themselves**.
- Genuinely new MCP-specific variant: **cross-server manipulation**.
  Because the model sees tool descriptions from every connected server
  in one shared context, a malicious server's description can hijack how
  the model treats a *different, legitimate* server's tools (e.g.
  instructing the model to route calls meant for a trusted server
  through the malicious one instead). No equivalent exists in a
  standalone, single-server LLM application.
- Same defense principle as security-llm section 1: constrain what
  actions are possible regardless of which instruction convinced the
  model to attempt them — don't rely on the model correctly identifying
  which server's description to trust.

## 7. Insufficient authentication & authorization (MCP07)
- The MCP-specific instance of API2/API5: an MCP server must verify who
  is calling and whether their role permits the requested tool, on every
  call — not just check that a valid token exists.
- Specific failure mode worth naming: **token passthrough** — a proxy
  MCP server forwarding the client's own token unchanged to an upstream
  API, rather than using or minting a token scoped specifically for that
  upstream call. This breaks per-service attribution and scoping (see
  MCP01) even when the original token itself was valid.
- This is distinct from tool poisoning: an accurately-described,
  correctly-schemed tool with no authorization check at all is MCP07,
  not MCP03 — nothing about the tool's definition is corrupted, the
  access-control check simply never happens.

## 8. Lack of audit and telemetry (MCP08)
- Same principle as the "excessive autonomy" fix in security-llm/
  security-agent (log every tool call so intermediate steps are
  traceable even when no single step triggers an approval gate) — named
  as its own category here because MCP's multi-server, multi-call nature
  makes the blind spot larger by default.
- Approval gates prevent bad outcomes; call-level audit logs are what
  let you trace or investigate which specific call in a long chain did
  something concerning, after the fact.

## 9. Shadow MCP servers (MCP09)
- The MCP-specific instance of API9 (Improper Inventory Management):
  you cannot review a server against any of the other nine categories if
  nobody knows it's still connected. A forgotten proof-of-concept server
  left running is unreviewed, undocumented, and un-auditable by
  definition.
- Maintain a current, actively reviewed inventory of every MCP server
  connected to a gateway or client, with a deliberate decommissioning
  step when a server is no longer needed.

## 10. Context injection & over-sharing (MCP10)
- The defining pattern here — the **"lethal trifecta"**: an agent with
  (1) access to private/sensitive data, (2) exposure to untrusted or
  external content, and (3) a way to communicate externally, all three
  at once, is inherently exfiltration-capable — regardless of whether
  any single tool call is individually authorized.
- The failure isn't any one call; it's the absence of a runtime check on
  *this specific combination*, in *this specific request*, moving data
  from a sensitive scope toward a public one.
- Fix with runtime policy enforcement on data-flow direction (human
  approval, or an explicit classification check before a write that
  would move data from private to public), not by banning
  private-read + public-write combinations outright — many legitimate
  agents genuinely need both, just not unchecked in the same flow.
- In a real incident, this often chains with MCP06 (cross-server
  manipulation delivering the malicious instruction) — flag both
  distinctly when both mechanisms are present, since one explains *how*
  the hijack happened and the other explains *why* the result was
  dangerous.

## How to apply this skill
1. Confirm security-baseline is already applied. Load security-llm and
   security-agent alongside this skill where the project's other
   properties call for them (any LLM involvement → security-llm; any
   autonomous/multi-step tool use → security-agent).
2. Ask about transport, number of connected servers, and whether the
   project is the server, the client, or both.
3. Walk sections 1–10 against the project's actual architecture.
4. Flag violations as explicit "areas of concern," naming which numbered
   section they violate. Where a section cross-references another skill
   (sections 1, 2, 4, 5, 6, 7, 8, 9), name both the MCP-specific
   instance and the general principle it extends, so the reviewer sees
   the connection rather than treating it as an isolated new rule.
5. For section 3 (tool poisoning) and section 10 (context injection)
   specifically — the two genuinely MCP-native risks with no direct
   equivalent elsewhere — give these the most scrutiny, since they're
   the ones a reviewer coming from traditional API/LLM security
   backgrounds is most likely to miss entirely.

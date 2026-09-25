---
name: security-agent
description: >
  Autonomous agent security policy skill, aligned to the OWASP Top 10
  for Agentic Applications (2026): Agent Goal Hijack, Tool Misuse &
  Exploitation, Identity & Privilege Abuse, Agentic Supply Chain
  Vulnerabilities, Unexpected Code Execution, Memory & Context
  Poisoning, Insecure Inter-Agent Communication, Cascading Failures,
  Human-Agent Trust Exploitation, and Rogue Agents. Use whenever a
  project is autonomous, multi-step, tool-using, or persists memory
  across turns — designing an agent architecture, reviewing a
  spec.md involving an agent, or for any agent security review, even
  unnamed. Assumes security-baseline is loaded; load alongside
  security-llm (this list extends LLM06 specifically) and security-mcp
  when the agent's tools are MCP-based. Stack-agnostic: no assumed
  framework (LangGraph, deepagents, or otherwise), orchestration
  pattern, or memory store.
summary: Reviews autonomous agent architectures against the OWASP Top 10 for Agentic Applications, extending security-llm's Excessive Agency category and complementing security-mcp.
---

# Agentic Application Security

Assumes security-baseline is loaded. This list extends security-llm's
LLM06 (Excessive Agency) — OWASP split that single category into four of
the ten below (1, 2, 5, 10) because a hijacked goal, a misused tool,
unsafe code execution, and a fully rogue agent each need a distinct
defense. Load alongside security-mcp when tools are MCP-based; several
entries here reference that skill directly.

Before applying this, ask how the agent plans (single-shot vs. multi-step
loop), what tools/memory it has, and whether it coordinates with other
agents — don't assume an architecture.

## 1. Agent goal hijack (ASI01)
- The entry point for most agentic compromise: an agent's actual
  objective gets altered mid-task by content it processes (a document,
  a tool result, a message from another agent) rather than by its
  original instruction.
- This is prompt injection (security-llm section 1) at the level of the
  agent's *plan*, not just its next response — a hijacked goal can
  persist across many subsequent steps, not just corrupt one output. A
  single-shot LLM app only ever risks one bad response; a multi-step
  agent that ingests untrusted content mid-task can have its entire
  remaining trajectory redirected before a human ever reviews anything.
- Defense: the same architectural principle as LLM01 — the agent's
  ability to act has to be constrained externally (tool scope, approval
  gates), since you can't reliably guarantee the model stays aligned to
  its original goal once it's ingested untrusted content mid-task.

## 2. Tool misuse & exploitation (ASI02)
- Distinct from ASI01: the agent's goal is unchanged and correct, but it
  invokes a legitimate tool in an unsafe way — wrong parameters, wrong
  sequence, or a use the tool was never intended for.
- Overlaps directly with security-mcp section 3 (tool poisoning) when
  the unsafe invocation is caused by a manipulated tool description; but
  it also happens with zero malicious tooling at all, purely from the
  agent's own faulty reasoning about how to use a tool correctly.
- Defense: validate tool call parameters against expected
  bounds/patterns before execution, independent of whether the tool
  itself is trustworthy — don't assume a well-behaved tool definition
  guarantees well-behaved invocation.

## 3. Identity & privilege abuse (ASI03)
- The agent-specific instance of Least Privilege (security-llm section
  6) and security-mcp's MCP01/MCP02, generalized beyond MCP: an agent
  inheriting or escalating high-privilege credentials, or acting under
  an identity broader than its task requires.
- Specific agent-native risk: an agent that impersonates or acts *as*
  the user it serves, with no way to distinguish "the agent decided
  this" from "the user explicitly approved this" in any resulting audit
  trail or downstream system.
- Defense: per-agent (not just per-user) scoped credentials, and audit
  trails that record actions as agent-taken vs. user-approved distinctly
  — never collapse the two into one identity.

## 4. Agentic supply chain vulnerabilities (ASI04)
- Extends security-baseline section 2 / security-llm section 3 /
  security-mcp section 4: agent frameworks, orchestration libraries,
  pre-built agent templates, and third-party sub-agents are all
  dependencies in the same trust sense as a package or an MCP server.
- Agent-specific addition: a **sub-agent** delegated to by an
  orchestrating agent is itself a supply-chain dependency — vet a
  third-party or community-published sub-agent the same way you'd vet
  any other untrusted code before letting your orchestrator delegate to
  it with real credentials.

## 5. Unexpected code execution (ASI05)
- The agent-specific instance of command injection (security-mcp
  section 5) and improper output handling (security-llm section 5),
  broadened: any path where an agent can generate and then execute code
  (a code-interpreter tool, a "write and run a script" capability) is a
  sink for the same untrusted-input-reaches-a-dangerous-sink pattern.
- Defense: sandbox any code-execution capability with the same rigor as
  security-baseline's infra-exposure rules — no code-execution tool
  should have broader system access than the specific task requires,
  and execution should happen in an isolated environment, not the agent
  host's own runtime.

## 6. Memory & context poisoning (ASI06)
- The agent-specific instance of data/model poisoning (security-llm
  section 4), but happening at a different timescale: instead of a
  one-time training-data attack, an agent with **persistent memory**
  across sessions can have false or malicious information written into
  its own memory store during one session, then reasoned over as fact in
  a later, unrelated session.
- Like a poisoning backdoor, this is hard to catch with normal
  evaluation of a single session, since the corrupted memory only
  surfaces later, in a different context.
- Defense: treat writes to persistent memory with the same scrutiny as
  training data provenance (security-llm section 4) — validate or flag
  memory entries derived from untrusted sources before they're trusted
  as fact in future sessions.

## 7. Insecure inter-agent communication (ASI07)
- Only relevant in multi-agent systems: messages passed between agents
  (a supervisor delegating to a worker, peer agents coordinating) need
  the same authentication, integrity, and input-validation treatment as
  any other trust boundary — don't implicitly trust a message just
  because it came from "another one of our own agents."
- Overlaps with security-mcp section 6's cross-server manipulation
  concept: a compromised or poisoned agent in the chain can inject
  malicious instructions into messages a downstream agent will treat as
  trusted.

## 8. Cascading failures (ASI08)
- A systemic risk unique to multi-agent or multi-step architectures: an
  error, hallucination, or compromise in one agent/step propagates
  through downstream agents/steps that trust its output, amplifying
  rather than being caught and contained.
- Defense: validate outputs at each hand-off point (the same
  "don't trust it just because it's internal" principle as ASI07),
  and design for graceful degradation/circuit-breaking rather than
  assuming a single bad step stays isolated.

## 9. Human-agent trust exploitation (ASI09)
- Distinct from every other category here: the attack targets the
  **human's** trust in the agent, not the agent's own reasoning or
  architecture — e.g. a user being socially engineered into approving
  an action at an approval gate (security-llm section 6) because the
  agent presented it in a way that discouraged scrutiny.
- Defense: approval-gate UX matters as much as the gate's existence —
  present enough context for a genuine decision, not a rubber-stamp
  click; watch for automation bias (a human approving because "the agent
  usually gets it right") as a real failure mode of the gate itself.

## 10. Rogue agents (ASI10)
- The extreme end of ASI01: an agent (or a component within it) acting
  entirely outside its intended objective, not just momentarily
  redirected by one piece of poisoned content.
- Defense: this is where security-mcp section 8's audit/telemetry
  principle and this skill's approval gates converge as a last line —
  continuous behavioral monitoring against expected patterns, with a
  kill-switch/deactivation path that doesn't depend on the agent's own
  cooperation to shut it down.

## How to apply this skill
1. Confirm security-baseline is applied. Load security-llm (always, for
   any agent — it's inherently an LLM application) and security-mcp
   (if tools are MCP-based).
2. Ask about planning style (single-shot vs. loop), tools, memory
   persistence, and multi-agent coordination.
3. Walk sections 1–10 against the project's actual architecture.
4. Flag violations as explicit "areas of concern," naming which section
   they violate and which other skill's principle they extend, where
   applicable (sections 1–7 and 10 all reference at least one other
   skill directly).

---
name: compliance-eu-ai-act
description: >
  EU AI Act compliance policy skill, covering the four-tier risk
  classification (unacceptable, high, limited, minimal), provider vs.
  deployer obligations, prohibited practices, high-risk system
  requirements, transparency duties, and the Act's agentic/MCP-specific
  scope. Use whenever a project is an AI system that may be placed on
  or used in the EU market — classifying a new AI feature's risk tier,
  reviewing an agent/model-calling architecture, drafting a spec.md
  involving an AI system, or whenever the user asks for an AI Act/AI
  regulatory review, even unnamed. Applies extraterritorially, based on
  where the system's output is used, not where the company is based.
  Assumes security-baseline and security-agent/security-mcp are already
  loaded where relevant — this skill covers legal/regulatory
  classification and obligations, not security controls, though the
  two overlap directly on logging, oversight, and the agentic action
  layer.
summary: EU AI Act compliance policy covering the four-tier risk classification (unacceptable, high, limited, minimal), provider vs. deployer obligations, prohibited practices, high-risk system requirements, transparency duties, and the Act's agentic/MCP-specific scope; walks a project's AI system against each tier and flags violations as named areas of concern, treating an unacceptable-risk match as a hard stop rather than a negotiable finding -- applies extraterritorially based on where the system's output is used, not where the company is based, and assumes security-baseline and security-agent/security-mcp are already loaded where relevant.
---

# EU AI Act Compliance

This skill covers what's specific to classifying and complying with the
EU AI Act — a legal/regulatory framework for AI *systems themselves*,
distinct from GDPR (which governs *data*). It does not repeat
security-agent's or security-mcp's control content, but several
obligations below (logging, human oversight, the action-layer scope)
are the same territory from a legal-obligation angle rather than a
security-control angle — apply both skills together for agentic
projects.

Before applying this, ask whether the AI system's output will be placed
on or used in the EU market (this determines whether the Act applies at
all, regardless of where the project is hosted or the company is
based), and whether this project is a provider (releasing or
substantially modifying a model) or a deployer (using a model/API
as-is) — the obligation level differs sharply between the two.

## 1. The four-tier risk classification
Classifying an AI system against this tier structure is the starting
point for everything else — it determines every downstream obligation.
- **Unacceptable risk** — banned outright, no compliance pathway exists
  at any documentation or oversight level. Article 5 prohibits eight
  practices, including manipulative or deceptive techniques affecting
  decision-making, and exploiting vulnerabilities based on age,
  disability, or poverty. These provisions have been enforceable since
  February 2025. If a project's proposed design matches one of these
  practices, flag it as a hard stop, not a design concern to mitigate.
- **High risk** — permitted, but with a heavy compliance burden: a risk
  management system, data governance, technical documentation, logging,
  human oversight, accuracy and cybersecurity, a quality management
  system, conformity assessment, and registration in an EU database.
  Systems fall here when used in sensitive domains — biometrics,
  critical infrastructure, education, employment and worker management,
  access to essential services, law enforcement, migration, and the
  administration of justice. Full obligations here have been
  enforceable since August 2, 2026.
- **Limited risk** — a single obligation: disclose to users that
  they're interacting with AI. Covers most chatbots and AI-generated
  content.
- **Minimal risk** — no mandatory obligations. Most everyday AI
  (recommendation engines, productivity tools, spam filters) sits here.

## 2. Provider vs. deployer
The same system can carry very different obligations depending on this
role, so classify it explicitly rather than assuming:
- **Deployer** (using a foundation model/API as-is, not training or
  substantially modifying it) — lighter obligations: transparency,
  human oversight, and confirming the model provider has done their own
  documentation. This is the role most projects here will actually be
  in, given the team's typical use of foundation models via API.
- **Provider** (releasing a model, or substantially modifying one) —
  the full, heavier obligation set. Ask explicitly whether any
  fine-tuning or substantial modification crosses this line before
  assuming deployer-level obligations are sufficient.

## 3. Agentic and MCP-specific scope
This is the part most directly relevant to tool-using/agentic projects,
and the part most likely to be missed by a review focused only on the
model's final text output:
- If an AI agent invokes APIs — internal services, third-party
  platforms, or MCP servers — that action layer is in scope under the
  Act's cybersecurity and logging mandates, not just the model's visible
  response.
- In a chain of AI agents, the compliance boundary extends to **every
  agent that performs a high-risk function**, not only the agent
  producing the final output shown to a human. A data-gathering
  sub-agent feeding a high-risk decision is in scope even if it never
  produces user-facing text.
- Cross-reference security-agent and security-mcp directly here: the
  audit/telemetry and human-oversight controls those skills recommend
  for security reasons are often the *same* controls this Act legally
  requires for high-risk systems — flag both angles together rather
  than treating them as separate findings.

## 4. Transparency and disclosure
- Any limited-risk system (most chatbots, AI-generated content) needs a
  clear, unavoidable disclosure that the user is interacting with AI —
  don't bury this in terms of service.
- For high-risk systems, transparency extends further: sufficient
  documentation for a deployer to understand the system's capabilities,
  limitations, and appropriate use.

## How to apply this skill
1. Ask whether the system's output will be placed on or used in the EU
   market — if not, the Act doesn't apply, though GDPR
   (compliance-gdpr) and security obligations still might.
2. Classify provider vs. deployer, then walk the system against the
   four risk tiers using the sensitive-domain list in section 1 as the
   test for high-risk.
3. For any agentic/tool-using system, apply section 3 explicitly and
   cross-reference security-agent/security-mcp.
4. Flag violations as explicit "areas of concern," naming the risk tier
   and which obligation is unmet. An unacceptable-risk match is a hard
   stop, not a flag to route to a policy owner — name it as such rather
   than framing it as negotiable.
5. Cross-reference compliance-gdpr for any system doing automated
   decision-making with significant effects on individuals — the same
   system is very likely to carry obligations under both frameworks
   simultaneously.

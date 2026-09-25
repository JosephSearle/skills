---
name: security-llm
description: >
  LLM application security policy skill, aligned to the OWASP Top 10 for
  LLM Applications (2025): Prompt Injection, Sensitive Information
  Disclosure, Supply Chain, Data/Model Poisoning, Improper Output
  Handling, Excessive Agency, System Prompt Leakage, Vector/Embedding
  Weaknesses, Misinformation, and Unbounded Consumption. Use whenever a
  project calls a model directly — chatbot, RAG pipeline, fine-tuned
  model, or any LLM-generated/consumed content — agentic or not. Load
  alongside security-agent for autonomous/tool-using projects; this
  skill covers the model layer specifically. Also load when drafting a
  spec.md with an LLM feature, or for any LLM/AI security review, even
  unnamed. Assumes security-baseline is already loaded. Stack-agnostic:
  no assumed model provider, vector database, or framework.
summary: LLM application security policy aligned to the OWASP Top 10 for LLM Applications (2025) -- prompt injection, sensitive information disclosure, supply chain, data/model poisoning, improper output handling, excessive agency, system prompt leakage, vector/embedding weaknesses, misinformation, and unbounded consumption; distinguishes risks with no complete technical fix (defended by constraining what the system allows the model to do) from ones with a concrete addable check, and flags any gap as a named area of concern -- assumes security-baseline is already loaded and covers only the model layer, loading alongside security-agent for autonomous/tool-using projects.
---

# LLM Application Security

Assumes security-baseline is already loaded. This skill covers what's
specific to calling or building on top of a language model — it does not
repeat secrets, dependency, or infra guidance from baseline.

A recurring theme across this skill, worth holding in mind throughout:
several of these risks (1, 4, 6) have **no complete technical fix** — the
model's reasoning can't be made structurally reliable, so the defense
has to live in what the system allows the model to do, not in trying to
make the model behave correctly every time. Others (2, 5, 7, 9) are
closer to the API skill's shape: a specific, addable check or a
structural choice that closes a real gap. Distinguishing which kind of
risk you're looking at determines whether "harden the model's judgment"
or "constrain the system around it" is the right response.

## 1. Prompt injection (LLM01:2025)
- An LLM reads system prompt, retrieved documents, tool outputs, and
  user input as one continuous, undifferentiated stream — there is no
  structural wall separating "instructions to obey" from "content to
  process," unlike parameterized queries separating code from data.
- This means input-side sanitization does not reliably work here:
  malicious instructions are just ordinary language, with no fixed
  syntax to filter out.
- The real defense is architectural, not linguistic: scope tool access
  tightly (see security-agent), require human approval for irreversible
  actions, and validate/constrain outputs before they trigger anything —
  build the wall around the model's actions, not inside its reasoning.
- Applies equally whether the malicious instruction is embedded in
  third-party content the user passes along (indirect) or typed by the
  user themselves (direct) — the defenses don't change based on who
  authored the instruction, since they constrain what actions are
  possible regardless of what convinced the model to attempt them.

## 2. Sensitive information disclosure (LLM02:2025)
- Two independent leak vectors, needing two independent checkpoints:
  - **Retrieval-side**: in a RAG system, unauthorized documents must
    never become candidates for retrieval in the first place — enforce
    access control at retrieval time (an object-level-authorization
    principle applied to the retrieval layer), not by hoping the model
    declines to repeat sensitive content it was handed.
  - **Output-side**: a model can memorize and reproduce fragments of its
    own training data (real PII, credentials, proprietary snippets) with
    no document ever retrieved — this has nothing to do with RAG at all.
    Scan generated output for PII/secret patterns before it reaches the
    user, since this vector has no upstream document to gate.
- A pre-retrieval check on the user's *question* alone is not sufficient
  — an entirely innocent-sounding question can still trigger retrieval
  of something sensitive.

## 3. Supply chain (LLM03:2025)
- Extends security-baseline's dependency-pinning discipline to model
  weights, datasets, and fine-tuning pipelines as trust boundaries too.
- Prefer model-checkpoint formats that cannot execute code on load
  (e.g. safetensors) over formats that can (pickle-based formats can
  embed instructions that execute automatically on deserialization,
  before any inference happens) — this is a structural, allowlist-style
  fix, not a matter of vetting the uploader's reputation harder.
- Treat third-party datasets, fine-tuning pipelines, and pretrained
  checkpoints as untrusted dependencies requiring the same scrutiny as
  any code dependency, per baseline section 2.

## 4. Data and model poisoning (LLM04:2025)
- A backdoor is deliberately rare and narrow by design — it's engineered
  to sit outside the distribution that normal evaluation samples from,
  so passing every standard eval cleanly does not rule this out.
- Structurally different from prompt injection: injection happens live,
  per-request, against an already-trained model; poisoning happens once,
  at training time, permanently baked into the weights — no live
  attacker input needed once the poisoned data is in the training set.
- The defense has to move upstream to the data itself, since a finished,
  poisoned model can't be reliably tested back out of it: track data
  provenance, run anomaly detection on training/fine-tuning datasets,
  and prefer verified internal sources over scraped public data for
  anything going into a training or fine-tuning run.

## 5. Improper output handling (LLM05:2025)
- Model output is just another form of untrusted input to whatever
  consumes it next — a frontend, a database, a shell, another API. This
  is not a new vulnerability class; it's pre-existing classes (XSS, SQL
  injection, command injection) resurfacing because "the model said it"
  gets treated as a reason to skip validation that would never be
  skipped for ordinary user input.
- Applies regardless of how the output was produced — whether from
  prompt injection or a pure, unprompted hallucination, an unescaped
  string reaching a sensitive sink is the same flaw either way.
- Fix with context-appropriate handling at the point of use: HTML-escape
  before rendering, parameterize before querying, never pipe into a
  shell or `eval()` — same principle as validating third-party API
  responses (API10).

## 6. Excessive agency (LLM06:2025)
- Excessive agency is a property of what capabilities a system granted
  the model, not a property of any specific mistake the model happens to
  make — "the model reasoned badly" is always true of every failure in
  this category and is not a useful diagnostic on its own.
- Three independent contributing factors, all worth checking separately:
  - **Unnecessary permissions**: any tool that can perform an
    irreversible or consequential action needs a hard, technical
    approval gate — not a system-prompt instruction asking the model to
    check first, which lives in the same undifferentiated stream as
    everything in section 1 and offers no real guarantee.
  - **Excessive tool scope**: apply the Principle of Least Privilege —
    a tool should only ever reach the narrowest scope its actual job
    requires (e.g. "read the caller's own calendar," never "read every
    calendar in the org"), regardless of whether any specific request
    would have abused the broader access.
  - **Excessive autonomy**: gating only irreversible actions leaves zero
    visibility into a long, reversible-step chain that produced the
    final gated action — a quietly wrong intermediate step can hide
    completely behind a normal-looking final output. The fix here is
    observability/audit-trail on every tool call, not more approval
    gates (which would eliminate the agent's autonomy entirely). Gates
    prevent bad outcomes; logging lets you catch or investigate bad
    intermediate behavior that a gate alone would miss.

## 7. System prompt leakage (LLM07:2025)
- A system prompt should be treated as inherently extractable — getting
  a model to repeat its own instructions is often trivially easy, so
  "prevent extraction" is not a reliable defense (same lesson as
  section 1).
- The real fix: never put anything in a system prompt that would be
  damaging if extracted. A system prompt is a definition file in the
  same sense as baseline section 1's "never hardcode a credential into a
  definition file" — apply that rule here explicitly.
- Business logic (thresholds, internal rules) is a separate judgment
  call from secrets: consider moving decision logic into a tool the
  model calls rather than a fact it states, both to reduce leak surface
  and because even "harmless" business rules exposed to an outsider are
  reconnaissance (the same principle as an overly verbose stack trace
  in API8) — they reveal exactly how the system can be gamed.

## 8. Vector and embedding weaknesses (LLM08:2025)
- The generic failure — authorization applied only after retrieval
  instead of scoped into the retrieval itself — is the same
  authorization-as-an-afterthought pattern as API1, just at the vector
  layer.
- What's specific to vector databases: most provide native, pushed-down
  metadata filtering or partitioning that scopes a similarity search to
  only the authorized subset *during* the search itself, so unauthorized
  vectors are never fetched or compared as candidates at all. Skipping
  this in favor of "search everything, filter the results afterward in
  application code" throws away a structural isolation mechanism the
  database provides, in favor of a bolt-on check that's one bug away
  from failing.
- For multi-tenant systems: a shared collection with per-tenant
  partitions/filters pushed into the search call is a reasonable,
  scalable choice — but the security property depends entirely on never
  falling back to post-search filtering anywhere in the implementation.

## 9. Misinformation (LLM09:2025)
- A model's confident tone carries no correlation with the accuracy of
  its content — a hallucinated package name, citation, API endpoint, or
  fact is stated in exactly the same fluent voice as something correct.
- Hallucination is the entry point, not the security failure itself
  (same shape as sections 1 and 5) — the actual failure is a person or
  system treating unverified model output as fact and acting on it
  without independent verification.
- Concrete instance worth naming directly: "slopsquatting" — attackers
  register package names that models are statistically likely to
  hallucinate, then wait for a developer to `pip install`/`npm install`
  on the model's word alone. Never install a package, cite a source, or
  publish a fact suggested by a model without checking it independently
  exists and is reputable first.

## 10. Unbounded consumption (LLM10:2025)
- The same principle as API4 (no limits on what a single request can
  demand), applied to inference specifically — and often worse, since
  cost scales with tokens (input length and output length both), and
  compute cost for longer contexts doesn't scale linearly.
- Cap input length and output token count per request, rate-limit by
  token volume as well as by request count, and set hard step/timeout
  limits on any agentic loop — an attacker can craft a prompt that
  causes excessive tool-call recursion, compounding cost across many
  downstream calls from what looked like one innocent request.
- On metered/cloud-billed inference, unbounded requests are a direct
  "denial of wallet" risk, not just a latency/availability one.

## How to apply this skill
1. Confirm security-baseline has already been applied. If the project is
   also an agent (tool-using, multi-step, autonomous), confirm
   security-agent is loaded alongside this skill — they're written to
   complement, not duplicate, each other.
2. Ask what kind of LLM feature this is (chat-only, RAG, fine-tuned,
   agentic) if not already known — which sections apply most heavily
   depends on this (e.g. section 8 only applies with a vector store;
   section 4 only applies if fine-tuning is involved).
3. Walk sections 1–10 against the project's actual design.
4. Flag violations as explicit "areas of concern," naming which numbered
   section they violate. For sections 1, 4, and 6 specifically — where
   there is no complete technical fix — flag the *system-level
   constraint* that's missing (a gate, a scope limit, a data-provenance
   check), not "the model needs to be more careful."

---
name: spike-generation
description: >
  Create a gold-standard technical spike document from scratch, or improve and update an
  existing spike. Detects spike type (technical, functional, architecture, research, design,
  prototyping, performance, usability, data), scans context for backlog and codebase signals,
  and writes a complete, timebox-bounded spike document to disk. Triggers on: "write a spike",
  "create a spike document", "draft a spike", "spike this out", "I need a spike for",
  "document this spike", "create an enabler story", "write a research spike", "update this
  spike", "improve this spike document", or any instruction to create, draft, update, or
  document a spike, research task, or timeboxed investigation.
---

# Spike Generation Skill

A skill for creating and updating technical spike documents to industry standards. Grounded in
Kent Beck's _Extreme Programming Explained_, Mike Cohn's _User Stories Applied_, the
Scaled Agile Framework (SAFe 6.0), and practitioner guidance from Ron Jeffries and Sophie Déziel.

---

## Core Philosophy

A spike is bounded by time, never by output. The timebox is the deliverable — when it ends,
the spike ends, regardless of what was found.

A spike is a throwaway experiment. Its artefact is the learning, not any code or prototype produced.

A spike document's job is to transfer that learning as efficiently as possible — dense,
findings-first, no padding.

---

## Step 1 — Mode Detection

```
Was a specific file path provided, or does the context include an existing spike document?
  └─ YES → Confirm it is a spike: look for timebox, hypothesis, findings sections, or
            "spike" in the title or filename
            └─ Confirmed spike → MODE = "update"
                                  Read the full document
                                  Classify each section as:
                                    [present + complete]  — accurate, substantive content
                                    [present + stub]      — section exists but is a placeholder
                                    [missing]             — section absent entirely
                                  Output a gap report before writing anything
            └─ Not clearly a spike → ask the user: "This doesn't look like a spike —
               should I treat it as one, or are you starting fresh?"
  └─ NO  → Search the working directory for existing spike files:
            Patterns: *spike*, *SPIKE*, filenames containing "investigate", "research",
            "exploration", or "enabler" in docs/, spikes/, doc/, or ./
            └─ Found one or more → present their names and first 50 words each
                                    ask: "I found N possible existing spike(s) — update one
                                    of these or create a new document?"
            └─ None found → MODE = "create"
```

**Hard rules for mode detection:**
- Never overwrite a `[present + complete]` Findings section without explicit user confirmation — this is the highest-value part of any completed spike
- In update mode: use declarative present tense for completed sections; future tense for pending ones
- Never silently reorder or rename sections in an existing document without flagging it to the user

---

## Step 2 — Context Scanning

Scan available context before generating any content. Record everything found; defer asking to Step 5.

**What to scan for:**

```
Is there a ticket or backlog URL in the user's request or attached files?
  └─ Jira, Linear, GitHub Issues ID or URL → record as Ticket Link

Is there a detectable tech stack in the working directory?
  └─ package.json, go.mod, pyproject.toml, Cargo.toml, Dockerfile → note the language and framework
     This informs type detection and the Approach section

Are there product requirements docs, RFCs, or architecture docs referenced?
  └─ Extract: system under investigation, key constraints, stakeholders mentioned

Is there an existing spike on the same topic in a sibling document?
  └─ Record for the Relationship to Prior Work section

Is there a sprint end date, demo date, or release date mentioned?
  └─ Record as the timebox anchor — this becomes the hard stop in Step 6
```

If nothing is found from scanning, defer all open questions to the single consolidated ask in Step 5.
Never prompt the user mid-generation.

---

## Step 3 — Spike Type Detection

Load `references/types.md`. Use the following decision tree to classify the spike (first match wins):

```
What is the primary question this spike is answering?

"Can we build X?" / "How would we build X?" / "What is the effort for X?"
  └─ Is X a foundational system capability (auth, CI/CD pipeline, deployment infrastructure)?
       └─ YES → Architecture spike or Infrastructure spike
       └─ NO  → Technical spike

"Is X technology feasible at all?" / "Does X library/API do what we need?"
  └─ Technical spike (feasibility variant)

"How should X look or feel?" / "Does the user understand X?"
  └─ UX or interaction design focused?
       └─ YES → Design spike or Usability spike
       └─ NO  → Functional spike

"What don't we know about X?" (domain, regulatory, market, legal)
  └─ Research spike

"How does X perform at scale?" / "Can X handle N requests / N users?"
  └─ Performance spike

"What is the data shape of X?" / "How is X structured in the external system?"
  └─ Data spike

"Can we prototype X quickly to validate an assumption before committing to build it?"
  └─ Prototyping spike

Ambiguous — two types seem equally applicable?
  └─ Report the top two candidates with the evidence for each
     Ask one disambiguating question before proceeding
```

The detected type is recorded in the document's metadata block and affects: who should run the spike,
the expected deliverable form, and how acceptance criteria are written. See `references/types.md` for
the full per-type reference table.

---

## Step 4 — Load References

```
Always load:
  references/universal.md        — Beck/Cohn/Jeffries timebox constraints, when-to-spike rules
  references/types.md            — SAFe + Agilemania full taxonomy (loaded in Step 3, keep in context)
  references/document-format.md  — Section-by-section format rules, prose style, anti-patterns

Load conditionally:
  Are any SAFe signals present in the request or context?
  (ART, PI Planning, System Demo, Enabler Story, WSJF, RTE, Solution Train)
    └─ YES → load references/safe-context.md
             This adds SAFe-specific section requirements and acceptance criteria format
```

---

## Step 5 — Gather Required Information

Before generating any content, resolve all required fields. Infer from context (Steps 2–3) where
possible. If three or more required fields are missing, ask the user once for all of them in a single
consolidated block — never interrupt generation with mid-task questions.

| Field | Infer from | Ask if missing? |
|---|---|---|
| Spike title | User's description | Yes |
| Spike type | Step 3 type detection | Confirm if ambiguous |
| Problem statement | User's request, context docs | Yes |
| Hypothesis | User's request | Yes — mandatory |
| Timebox duration | Sprint/date mentions in context | Yes — must be a concrete duration |
| Acceptance criteria | User's stated success criteria | Yes — at least one required |
| Ticket link | URL/ID found in Step 2 | No — include if found, omit if not |
| Stakeholders | Mentioned in context docs | No — use `<TODO>` if unknown |
| Technology / domain | Stack scan from Step 2 | No — use `<TODO>` if unknown |

**Minimum viable set to proceed without asking:** a problem statement + a hypothesis + a timebox
duration — all three must be present or inferable before generation begins.

**Single consolidated question block when asking:**

```
Before I write the spike, I need a few details I couldn't determine automatically:

1. What is the specific question this spike must answer? (problem statement)
2. What do you currently believe the answer is? (hypothesis — a guess is fine)
3. How long is the timebox? (e.g. "2 days", "1 sprint" — a concrete duration, not "as needed")
```

If SAFe context is detected, add:
```
4. Which ART or team should receive the findings after the spike completes?
```

---

## Step 6 — Generate the Spike Document

Apply `references/document-format.md` for all prose style and section-level rules.

### Output location

```
Does a spikes/ or docs/spikes/ directory exist in the working directory?
  └─ YES → write there
Does a docs/ directory exist?
  └─ YES → write to docs/spikes/ (create the subdirectory if needed)
Otherwise:
  └─ Write to the working directory root

Filename format: YYYY-MM-DD-<type>-spike-<slug>.md
  Examples:
    2026-05-15-technical-spike-jwt-token-refresh.md
    2026-05-15-architecture-spike-multi-region-deployment.md
    2026-05-15-performance-spike-search-query-latency.md
    2026-05-15-research-spike-gdpr-session-storage.md

In update mode: write to the same path as the existing file, preserving the filename.
```

### Required sections — all 10 are mandatory in every spike document

**1. Title and Metadata Block**

```markdown
# <Spike Title>

| Field      | Value                                      |
|------------|--------------------------------------------|
| Type       | <spike type from Step 3 taxonomy>          |
| Status     | Draft                                      |
| Timebox    | <duration> (ends <YYYY-MM-DD if known>)    |
| Date       | <YYYY-MM-DD>                               |
| Ticket     | <link or ID, or —>                         |
```

Status must be one of: `Draft | In Progress | Completed | Abandoned`

**2. Problem Statement**

What is unknown, why it matters, and what decision this spike unblocks. Maximum 3 sentences —
apply the density principle from `references/document-format.md`. No background narrative.

**3. Hypothesis**

A falsifiable prediction in the form: "We believe that X will enable Y, which will allow us to Z."

If the user has no hypothesis yet, generate a placeholder in the correct form and mark it:
`<HYPOTHESIS — confirm or replace before running the spike>`

A spike without a hypothesis is an unbounded investigation. This section is mandatory.

**4. Acceptance Criteria**

1–5 items. Each in the form: "We will know this spike is complete when [observable outcome or
elapsed time]."

Criteria must bound time or observable learnings — never a working implementation or shipped feature.
Valid: "when we have spent 2 days evaluating Redis and documented our findings."
Invalid: "when we have a working Redis session store."

If SAFe context is loaded: format as a Given/When/Then list or checkbox list per `references/safe-context.md`.

**5. Approach / Method**

An ordered bulleted list of investigation steps — what will be tried and in what sequence.
Include an explicit scope boundary at the end:

```markdown
**Out of scope for this spike:**
- <item 1 — what will NOT be investigated>
- <item 2>
```

This is an investigation plan, not a build plan. Do not specify implementation detail.

**6. Timebox and Scope Constraints**

The most important structural section — it prevents scope creep and encodes Beck's principle:

```markdown
Work stops at <date or sprint boundary> regardless of completion status.

**Explicitly out of scope:**
- <item>
```

The hard stop statement must be present. "Regardless of completion" is a required phrase.

**7. Findings**

At creation time, write a structured stub. Do not leave this section empty — the structure
guides whoever runs the spike:

```markdown
> Complete this section after the spike executes.

### What We Tried
<!-- Describe each approach attempted in order -->

### What We Learned
<!-- State what the evidence showed — not what you tried, but what you concluded from it -->

### Evidence and Links
<!-- Links to code, benchmarks, recordings, prototype branches — not prose descriptions of them -->
```

In update mode when findings exist: preserve all existing content. Enrich stubs only where
content is genuinely absent.

**8. Conclusion and Recommendation**

Lead with the recommendation — the decision in the first sentence, before any evidence.
Sub-sections:

- **Decision** — one sentence: "We recommend X" / "We have ruled out X" / "We cannot conclude — see Risks"
- **Evidence Summary** — 3–5 bullets, each a single sentence, supporting the decision
- **Next Steps** — maximum 3 items: what happens immediately after this spike closes

Add a **Pros / Cons** sub-section only when the spike identified multiple viable approaches and
the team must choose between them. Omit for binary outcomes (feasible/not feasible).

At creation time, write the Conclusion as a stub: `> Complete this section after the spike executes.`

**9. Risks and Open Questions**

| Risk / Question | Impact if unresolved |
|---|---|
| <item> | <impact> |

Maximum 5 rows. More than 5 means the spike scope is too wide — narrow it.
Questions this spike did not resolve belong here explicitly, so follow-on spikes can be scoped.

**10. Relationship to Prior Work**

Links to prior spikes on the same topic, and to any ADRs this spike's findings will inform.
"None" is a valid entry — this section must exist to confirm it was checked, not left implicit.

### Optional sections — generate when information is available

- **Stakeholders and Demo Audience** — required when SAFe context is loaded (see `references/safe-context.md`)
- **Prototype / Artefact Location** — link to any throwaway branch, notebook, or sandbox created during the spike
- **Resources and References** — external docs, papers, or vendor material consulted

---

## Step 7 — Validate Before Writing

Run this checklist before writing to disk. A spike that fails any required check must be corrected first.

**Structure:**
- [ ] All 10 required sections are present
- [ ] Timebox is a concrete duration — not "as needed", "until done", or "TBD"
- [ ] Hypothesis is in falsifiable form — not "we will investigate X" or "we will explore X"
- [ ] Acceptance criteria bound time or observable learnings — not a working implementation
- [ ] Findings section is a structured stub (create mode) or has substantive content (update mode, completed spike)
- [ ] Conclusion section leads with the recommendation, not with preamble or summary

**Content:**
- [ ] Acceptance criteria count: 1–5 (reject if 0 or >5)
- [ ] Risks and Open Questions count: ≤5 rows
- [ ] Problem Statement: ≤3 sentences
- [ ] Spike type in the metadata block matches the type detected in Step 3
- [ ] Status field is set to the correct value for the current state

**SAFe-specific (only when `references/safe-context.md` was loaded):**
- [ ] Stakeholders and Demo Audience section is present and names the ART or team
- [ ] Acceptance criteria use Enabler Story format (Given/When/Then or checkbox)
- [ ] Findings section includes a "Shared to" subsection

---

## Step 8 — Write to Disk & Post-Write Guidance

Write the completed spike document to the output path determined in Step 6.

**In update mode:** If more than 40% of a `[present + complete]` section would be replaced,
confirm with the user before writing. Show what will change.

**Post-write output:**

```
Spike document written to: <path>

Complete sections:   <list>
Stub sections:       <list — fill these in after the spike runs>
Pending from you:    <any <TODO> placeholder fields>

After the spike runs:
  1. Fill in Findings — what you tried, what you learned, and links to evidence
  2. Update Conclusion — put the recommendation in the first sentence
  3. Update Status → "Completed" or "Abandoned"
  4. Share findings with: <named stakeholders, or TODO if not identified>
```

If SAFe context was loaded, also include:
```
SAFe next steps:
  - Demonstrate findings at the next System Demo
  - Update Enabler Story <ticket> status to Done after the demo
  - Confirm findings were shared to <ART/team> in the Findings "Shared to" section
```

---

## Hard Rules

- **Never write a spike without a timebox expressed as a concrete duration** — "as needed" or "until done" violates the foundational Beck/Cohn constraint
- **Never write acceptance criteria that require a working implementation as the exit condition** — spikes exit on elapsed time or a learning outcome, never on delivery
- **Never generate more than 5 acceptance criteria** — if the scope requires more, narrow the spike
- **Never skip the Hypothesis section** — a spike without a hypothesis is an unbounded investigation that will expand to fill whatever time is available
- **Never set Status to `Completed` unless the Findings section contains substantive content** — a stub Findings section in a "Completed" spike signals that the learning was lost

---

## Reference Files

- `references/universal.md` — Foundational spike constraints from Beck, Jeffries, and Cohn: timebox rules, when to create a spike, the spike-story relationship, and the spike vs PoC distinction
- `references/types.md` — Full spike taxonomy from SAFe 6.0 and Agilemania: exploration, architecture, infrastructure, research, design, prototyping, technical, functional, performance, usability, and data spikes — with per-type guidance on who runs them, typical timeboxes, and deliverable form
- `references/document-format.md` — Section-level format rules, the density principle, findings-first conclusion structure, stub formats, prose style, and anti-patterns to flag and fix
- `references/safe-context.md` — SAFe Enabler Story formal requirements: estimation, demonstration, cross-ART sharing, acceptance criteria format, and WSJF escalation signals — load only when SAFe context is detected

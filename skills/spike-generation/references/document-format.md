# Spike Document Format Reference

Primary authorities: Sophie Déziel — "How We Do Spikes" (Medium, 2016) | GeeksforGeeks — "What Is a Spike in Agile?" | Agilemania — spike documentation guidance

---

## 1. The Density Principle

Déziel: "Keep it short, but very dense in information."

A spike document is not a research paper. It is a transfer mechanism — moving learning from the engineer who ran the spike to the rest of the team as quickly as possible. Every sentence must earn its place.

**Per-section density rules:**

| Section | Maximum length |
|---|---|
| Problem Statement | 3 sentences |
| Hypothesis | 1–2 sentences |
| Acceptance Criteria | 1–5 items |
| Approach / Method | 5–8 bullets plus an out-of-scope list |
| Timebox and Scope Constraints | 1 hard stop statement + out-of-scope list |
| Findings — What We Tried | 1 short paragraph or bullet list per approach |
| Findings — What We Learned | 1–3 key conclusions |
| Findings — Evidence and Links | Links only — no prose descriptions of what the links contain |
| Conclusion — Decision | 1 sentence |
| Conclusion — Evidence Summary | 3–5 bullets |
| Conclusion — Next Steps | Maximum 3 items |
| Risks and Open Questions | Maximum 5 rows |

---

## 2. Findings-First Conclusion

The most important formatting principle. Déziel: findings first, reasoning second.

**Wrong:**
```markdown
## Conclusion and Recommendation

After spending two days evaluating Redis and Postgres for session storage,
we looked at several factors including latency, operational overhead, and
our team's existing expertise. We ran benchmarks under simulated load and
reviewed the vendor documentation. Based on all of this, we recommend Redis.
```

**Right:**
```markdown
## Conclusion and Recommendation

**Decision:** We recommend Redis for session storage.

**Evidence Summary:**
- Redis p99 latency was 4ms vs Postgres at 38ms under 5k concurrent sessions
- Operational overhead is comparable — both are already in our stack
- The team has existing Redis expertise; no ramp-up required

**Next Steps:**
1. Write the session storage implementation story (estimate: 3 points)
2. Add Redis session config to the infrastructure runbook
```

The recommendation comes first. A team member reading only the first line of the Conclusion should know the answer. The Evidence Summary supports that answer — it does not build toward it.

---

## 3. Findings Section Format

### Pre-execution (stub — at spike creation time)

```markdown
## Findings

> Complete this section after the spike executes.

### What We Tried
<!-- Describe each approach attempted, in the order you tried it -->

### What We Learned
<!-- What did the evidence show — not what you did, but what you concluded from it -->

### Evidence and Links
<!-- Links to code branches, benchmark results, recordings, prototypes — not prose about them -->
```

### Post-execution (completed spike)

```markdown
## Findings

### What We Tried
We evaluated Redis Pub/Sub and Redis Streams as alternatives to WebSockets for
real-time delivery. We ran each against a simulated load of 10k concurrent subscribers
using a local k6 script against our staging cluster.

### What We Learned
Redis Pub/Sub delivers messages to all subscribers but has no persistence — messages
sent when a subscriber is offline are lost. Redis Streams solves this but adds consumer
group management overhead that our current platform team does not have the capacity to
operate. Neither option eliminates the need for a fallback mechanism.

### Evidence and Links
- [Benchmark results — k6 report](https://example.internal/benchmarks/redis-pubsub-2026-05-15)
- [Test script](https://github.com/org/repo/tree/spike/redis-pubsub-eval)
- [Redis Streams vs Pub/Sub decision notes](https://notion.so/...)
```

**The Evidence and Links sub-section is links, not prose.** Déziel: "embed findings where the work lives." Link to the actual artefact — a branch, a benchmark report, a Notion page, a video recording. A prose description of what you would find at that link adds length without adding information.

---

## 4. Prose Style Rules

**Active voice in conclusions.** Not "Redis was found to be faster" — "Redis was 8x faster." Not "it was determined that X" — "we determined X."

**Declarative sentences in the Conclusion.** The Conclusion section makes decisions. Hedging language is not appropriate there:
- Wrong: "Redis might be a good fit."
- Wrong: "We believe Redis could potentially work for our use case."
- Right: "Redis meets our latency requirement. We recommend it."

**Hedging is appropriate in Findings.** Findings report evidence, which may be incomplete:
- "Under simulated load, Redis p99 latency was 4ms. We did not test beyond 10k concurrent connections."
- "The vendor documentation is ambiguous on rate limiting behaviour. We were unable to verify it in the spike timebox."

**Past tense in Findings for completed spikes.** Future tense only for pending sections in in-progress spikes.

---

## 5. Anti-Patterns — Flag and Fix

When reviewing or updating an existing spike document, flag these problems and propose corrections:

| Anti-pattern | Problem | Correction |
|---|---|---|
| Findings section is longer than the Conclusion | Evidence was enumerated, not synthesised | Compress Findings to 3 key points; expand Conclusion to state the decision clearly |
| Acceptance criterion: "implement a working X" | Requires a deliverable, not a learning | Rewrite as: "evaluate X and document whether it meets [criteria]" |
| Timebox stated as "as needed" or "TBD" | Violates the foundational Beck/Cohn constraint | Replace with a concrete duration: "2 days", "1 sprint" |
| Hypothesis written as "we will investigate X" | Non-falsifiable — describes activity, not a prediction | Rewrite as: "We believe X will [outcome], which will [consequence]" |
| Conclusion begins with "After thorough research..." | Buries the decision | Move the decision to the first sentence |
| Evidence and Links section contains prose | Adds length without adding information | Replace prose with links to actual artefacts |
| More than 5 acceptance criteria | Spike is too wide | Split into multiple spikes, each with ≤5 criteria |
| Status = "Completed" with stub Findings | Learning was not captured | Either fill in the Findings or set Status to "Abandoned" |

---

## 6. GeeksforGeeks Structural Template (Baseline Fields)

The following fields are the minimum information set for a spike ticket or document. Every spike must resolve all of them before generation begins:

| Field | Purpose | Required? |
|---|---|---|
| Title | Identifies the spike unambiguously | Yes |
| Type | Classifies the investigation | Yes |
| Ticket / Link | Connects the spike to the backlog item it unblocks | Recommended |
| Problem Statement | States what is unknown and why it matters | Yes |
| Hypothesis | States what the team currently believes | Yes |
| Assumptions | Lists what the team is taking as given without verifying | Yes — at least one |
| Acceptance Criteria | Defines the observable exit conditions | Yes — 1 to 5 |
| Timebox | Sets the hard stop | Yes — must be concrete |
| Approach | Orders the investigation steps | Yes |
| Findings | Records what the team learned | Yes — stub at creation |
| Conclusion | States the recommendation | Yes — stub at creation |
| Risks / Open Questions | Records what remains unresolved | Yes |

The Assumptions field maps to the Approach / Method section's scope boundary in the full 10-section format. Where the GeeksforGeeks template has a separate Assumptions section, the full format captures the same content as the "Out of scope for this spike" boundary in the Approach section.

# Architecture Decision Records (ADRs) Reference

Authority: Michael Nygard — "Documenting Architecture Decisions" (2011)
See also: https://adr.github.io | https://martinfowler.com/bliki/ArchitectureDecisionRecord.html

---

## 1. Format Specification

Every ADR is a single Markdown file. Fields:

| Field | Required | Description |
|---|---|---|
| Number | Yes | Sequential 4-digit integer, zero-padded: `0001`, `0042` |
| Title | Yes | Short imperative phrase: "Use PostgreSQL for primary datastore" |
| Date | Yes | ISO 8601 date of the decision: `2024-03-15` |
| Status | Yes | One of: `Proposed`, `Accepted`, `Deprecated`, `Superseded`, `Rejected` |
| Deciders | Recommended | Names or roles of decision-makers |
| Context | Yes | The situation and forces that require a decision |
| Decision | Yes | The decision itself, stated clearly in 1–2 sentences |
| Rationale | Yes | Why this decision over alternatives; name alternatives rejected |
| Consequences | Yes | Positive, negative, and neutral outcomes |
| Related Decisions | Recommended | Links to superseded, superseding, or related ADRs |

---

## 2. Status Lifecycle

```
Proposed
  └─ Under discussion or review — not yet current practice
  └─ May be rejected after review → Rejected (terminal)
  └─ May be accepted → Accepted

Accepted
  └─ Current practice — this is how we do it
  └─ May be deprecated (no longer relevant, not replaced) → Deprecated (terminal)
  └─ May be replaced by a newer decision → Superseded (terminal for this ADR)

Deprecated
  └─ No longer applicable — e.g., the system component it governed was removed
  └─ Not replaced by another ADR (if it were, it would be Superseded instead)

Superseded
  └─ Replaced by a newer ADR
  └─ Must include: "Superseded by [ADR-NNNN](NNNN-title.md)"
  └─ The superseding ADR must include: "Supersedes [ADR-NNNN](NNNN-title.md)"

Rejected
  └─ Was considered but not adopted
  └─ Keep the record — prevents re-litigating the same decision
  └─ Include in Rationale: why it was rejected
```

**The immutability rule:** Accepted ADRs are never edited to change their decision or rationale. If the decision changes, create a new ADR that supersedes the old one. The historical record of what was decided and why must be preserved. The *only* allowed edits to an accepted ADR are: adding the "Superseded by" line and updating the status field.

---

## 3. Naming and Numbering Convention

**File name format:** `NNNN-verb-noun-phrase.md`

The title should complete the sentence "We decided to...":
- `0002-use-postgresql-as-primary-datastore.md`
- `0003-adopt-jwt-for-api-authentication.md`
- `0007-implement-event-sourcing-for-order-domain.md`
- `0012-migrate-from-rest-to-graphql.md`

**Rules:**
- Always 4-digit zero-padded numbers: `0001`, not `1` or `01`
- Kebab-case title after the number
- Present tense or past tense is fine; be consistent within a project
- Never reuse numbers, even if an ADR is rejected
- Sequential — do not leave gaps

---

## 4. Linking and Cross-Referencing

**How to reference another ADR in body text:**
> "See [ADR-0003](0003-adopt-jwt-for-api-authentication.md) for the authentication decision that drives this requirement."

**How to mark a superseded ADR (update the old ADR):**
```markdown
**Status:** Superseded by [ADR-0012](0012-migrate-from-rest-to-graphql.md)
```

**How to write the superseding ADR:**
```markdown
**Status:** Accepted
...
## Related Decisions
- Supersedes: [ADR-0005](0005-use-rest-for-all-internal-apis.md)
```

**Cross-reference guidance:**
- Link to ADRs when a decision depends on or conflicts with another decision
- Link to ADRs from code using comments: `// See ADR-0003 for why we use JWT here`
- Link to ADRs from README sections when the technology choice is documented there

---

## 5. Writing the Context Section

The Context section is the most important and most commonly written poorly. Guidelines:

**Describe the problem, not the solution.** The decision goes in the Decision field. The Context describes why a decision is needed.

**Include constraints explicitly:**
- Technical constraints: "We must run on AWS Lambda, which limits execution time to 15 minutes"
- Organisational constraints: "The team has no Go expertise; adopting Go would require significant ramp-up"
- Regulatory constraints: "GDPR requires data residency in the EU"
- Cost constraints: "Our monthly infrastructure budget is €X"

**Include the forces at play:** What are the competing concerns? Performance vs. cost? Consistency vs. availability? Simplicity vs. flexibility? Naming these explicitly makes the rationale easier to follow.

**Keep it stable:** Write about the situation as it was at decision time. Do not update the Context if circumstances change — create a new ADR instead.

---

## 6. Writing the Rationale Section

The Rationale section is what separates useful ADRs from useless ones. A Decision field alone is not enough — "We chose PostgreSQL" could mean a dozen different things in context.

**Name the alternatives explicitly:**
> "Alternatives considered: MySQL (rejected: team has more PostgreSQL expertise and superior JSON support was needed), SQLite (rejected: insufficient concurrency for expected load), MongoDB (rejected: transaction requirements are relational in nature)."

**Name the deciding trade-offs:**
> "The deciding factor was JSONB support in PostgreSQL, which avoids the need to serialise structured data for the reporting queries described in [ADR-0008]."

**Be specific about what "better" means.** "PostgreSQL is more mature" is not a rationale. "PostgreSQL's JSONB indexing outperforms MySQL's JSON column type for our query pattern (range queries on nested fields)" is a rationale.

---

## 7. What Deserves an ADR

**The decision test:** If a future maintainer would ask "why was this done this way?", it deserves an ADR.

**Good candidates:**
- Technology choices (language, framework, database, message broker, cloud provider)
- Architectural patterns (event sourcing, CQRS, saga pattern, service mesh)
- Integration approaches (REST vs. gRPC, sync vs. async)
- Security decisions (auth mechanism, encryption at rest, key management)
- Significant trade-offs accepted (consistency vs. availability, simplicity vs. scalability)
- Decisions not to do something common (e.g., "decided not to use a service mesh")

**Poor candidates:**
- Code style choices (belong in a linter configuration)
- Trivial library selections with no meaningful trade-offs
- Implementation details that will change frequently
- Decisions that are reversible at low cost (not worth the overhead of an ADR)
- Decisions so obvious they require no explanation

**The reversibility test:** The more expensive and disruptive to reverse a decision, the more it deserves an ADR. Choosing a database is nearly irreversible. Choosing a logging format is not.

---

## 8. ADR Anti-Patterns

**The decision-only ADR.** An ADR that says only "We chose X" with no context or rationale is worse than no ADR — it gives false confidence that the decision was considered when no record of the consideration exists.

**The essay ADR.** An ADR that runs to five pages is too long. Target: 1–2 pages. If the decision requires more explanation, the decision may need to be broken into multiple decisions.

**The post-hoc rationalisation.** Writing an ADR for a decision that has already been made and implemented, with no record of the alternatives considered, is better than nothing but still misleading. Write ADRs when decisions are being made, not after the code is in production.

**Never-accepted ADRs.** A pile of `Proposed` ADRs that were never reviewed or accepted is not a decision log — it is a backlog. Establish a process: ADRs that are not accepted within 2 weeks of being raised should either be formally accepted or rejected.

**Editing accepted ADRs.** The moment you change the content of an accepted ADR, you lose the historical record. Always supersede, never edit.

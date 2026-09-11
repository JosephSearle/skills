# ADR-<NNNN>: <Short noun phrase naming the decision>

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-<NNNN>
**Date:** <YYYY-MM-DD>
**Deciders:** <names or roles>

## Context and Problem Statement

<Describe the forces at play — technical, organisational, or regulatory constraints
— and the problem that makes a decision necessary. Write in neutral, descriptive
language rather than a persuasive pitch for the option you picked; a good ADR lets
a future reader reach the same conclusion independently, not just accept yours.
This is the "Context" discipline from Nygard's original format [1].>

## Considered Options

- <Option 1>
- <Option 2>
- <Option 3>

<List every option seriously evaluated, not only the winner. This is the addition
MADR makes on top of Nygard's original five sections [2], and it's what lets a
future reader judge whether the reasoning still holds once circumstances change.>

## Decision

We chose **<Option X>** because <primary reasoning, one or two sentences,
starting "We decided to..." or "We will use...">.

## Rationale

<Why this option over the others? Name each rejected option and the specific
trade-off that ruled it out. Avoid vague justifications — "it's more scalable"
should be backed by what "scalable" means for this decision.>

## Consequences

### Positive
-

### Negative
-

### Risks / Unknowns
-

## Related Decisions

- Supersedes:
- Superseded by:
- Related:

---

### Fast-track alternative: Y-Statement

For a smaller decision that doesn't warrant a full document, use Olaf
Zimmermann's single-sentence Y-Statement format instead of the template above [6]:

> In the context of `<use case / component>`, facing `<concern or force>`,
> we decided for `<option>` to achieve `<quality or benefit>`,
> accepting `<downside or trade-off>`.

Promote it to a full ADR later if the decision turns out to be more
consequential or more contested than expected.

---

## Sources

- [1] Michael Nygard, *Documenting Architecture Decisions* (2011) — <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html>
- [2] MADR — Markdown Any Decision Records — <https://adr.github.io/madr/>
- [6] Zdun, Capilla, Tran, Zimmermann, *Sustainable Architectural Design Decisions*, IEEE Software 30(6), 2013 — <https://www.infoq.com/articles/sustainable-architectural-design-decisions/>

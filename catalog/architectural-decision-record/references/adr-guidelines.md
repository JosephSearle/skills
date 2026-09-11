# Internal Guideline: Writing and Maintaining Architecture Decision Records

## Why we do this

Agile teams aren't opposed to documentation — only to documentation that never
gets kept up to date. Large specification documents rot; small, modular ones
have a real chance of staying current, and are what makes it possible to track
the motivation behind a decision months or years after it was made [1]. That's
the entire case for ADRs: one short, dated file per architecturally significant
decision, kept next to the code it describes.

## When to write one

Write an ADR when a decision affects any of the following (not every
configuration change qualifies) [1][4]:

- **Structure** — e.g. adopting a pattern like microservices or CQRS
- **Non-functional characteristics** — security posture, availability, fault
  tolerance targets
- **Dependencies** — coupling between components or external systems
- **Interfaces** — APIs, published contracts
- **Construction techniques** — frameworks, libraries, processes (e.g. a
  branching workflow)

Three anti-patterns to actively guard against, per AWS's guidance on this
process [4]:

1. **No decision gets made at all**, out of fear of choosing wrong.
2. **A decision is made with no recorded rationale**, so the same debate
   resurfaces weeks later.
3. **A decision is made but never captured**, so the team forgets it happened
   and a new contributor unknowingly reverses it.

## Where they live

Store ADRs as Markdown in the same repository as the code, in a stable
directory such as `docs/adr/`. ThoughtWorks placed this practice in the
**Adopt** ring of their Technology Radar — their strongest endorsement — on
the basis that source control keeps the record in sync with the code itself,
gives free authentication (whoever has commit rights has ADR rights), and
makes decisions discoverable through ordinary code search [5].

## Format

Default to the template in `adr-template.md` — Nygard's original structure [1]
extended with MADR's "Considered Options" section [2], which is worth the
extra few minutes because it lets a future reader see what was actually on the
table. For a small or fast-moving decision that doesn't justify a full
document, use the one-sentence Y-Statement format instead, and promote it to a
full ADR later if it turns out to matter more than expected [6].

## Ownership and review

Any team member can propose an ADR — don't centralise this with a single
architect. Distributing the research work this way also distributes ownership
of the decision, which tends to produce faster buy-in than a decision handed
down from above [4]. Review an ADR the same way you review code: open it as a
pull request, get sign-off from whoever's affected, then merge.

## Numbering and lifecycle

- Number ADRs sequentially; numbers are never reused, even for a deprecated
  or rejected decision.
- Status moves through **Proposed → Accepted** (or **Rejected**).
- **Once accepted, an ADR is immutable.** If new information changes the
  decision, write a new ADR that supersedes the old one, and update the old
  ADR's status to `Superseded by ADR-NNNN` rather than editing its content [4].
  This preserves the historical record instead of erasing it.

## Tooling

Plain Markdown files are enough to start. If it's worth automating:

- **`adr-tools`** — CLI for scaffolding, numbering, and superseding ADRs from
  the terminal.
- **Log4brains** — turns the same Markdown files into a searchable, browsable
  static site, useful once the decision log grows past a handful of files [7].

## Getting started

1. Copy `adr-template.md` into `docs/adr/`.
2. Write ADR-0001 documenting the decision to use ADRs at all — this is the
   standard first entry in the log and gives new contributors an obvious
   starting point.
3. Add "does this need an ADR?" as a checklist item in your PR template so the
   habit doesn't quietly lapse after the first month.

## Sources

- [1] Michael Nygard, *Documenting Architecture Decisions* (2011) — <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html>
- [2] MADR — Markdown Any Decision Records — <https://adr.github.io/madr/>
- [3] joelparkerhenderson/architecture-decision-record (template & tooling collection) — <https://github.com/joelparkerhenderson/architecture-decision-record>
- [4] AWS Prescriptive Guidance: *Using Architectural Decision Records to Streamline Decision-Making* — <https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/introduction.html>
- [5] ThoughtWorks Technology Radar: *Lightweight Architecture Decision Records* (Adopt) — <https://www.thoughtworks.com/en-us/radar/techniques/lightweight-architecture-decision-records>
- [6] Zdun, Capilla, Tran, Zimmermann, *Sustainable Architectural Design Decisions*, IEEE Software 30(6), 2013 — <https://www.infoq.com/articles/sustainable-architectural-design-decisions/>
- [7] ADR Tooling directory — <https://adr.github.io/adr-tooling/>

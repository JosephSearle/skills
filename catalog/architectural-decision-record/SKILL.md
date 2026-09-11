---
name: architectural-decision-record
description: Creates an Architecture Decision Record (ADR) for a codebase -- gathering the real context first by questioning the user about their idea and investigating the repository itself, rather than generating a document from a one-line request. Based strictly on the org's internal ADR guidelines (Nygard/MADR/AWS/ThoughtWorks-sourced) and its ADR template as the golden standard for format and process. Use whenever someone wants to create, write, or draft an ADR; document, record, or capture an architectural/design decision; asks "should this be an ADR" or "do we need an ADR for this"; or describes choosing between technical approaches in a way that has lasting structural, dependency, interface, non-functional, or construction-technique consequences, even if they don't name the ADR format explicitly. Writes the finished ADR into the repo's decision log with correct sequential numbering, and explicitly flags when a request should become multiple ADRs instead of one.
summary: Creates an Architecture Decision Record by questioning the user and investigating the codebase for real context before drafting, based on the org's internal ADR guidelines and template.
---

# Architectural Decision Record

Creates one ADR at a time, the way the org's guidelines describe: a short,
dated, immutable record of one architecturally significant decision, filed
next to the code it describes. The job here is less "fill in a template" and
more "make sure the template gets filled in with something true" -- an ADR
built from an under-specified request is worse than no ADR at all, because it
reads as a real historical record while actually being a guess.

## Sources of truth

- `references/adr-guidelines.md` -- the org's internal guideline on why, when,
  and how ADRs get written, reviewed, numbered, and superseded. This is the
  process spec; read it in full before the first time you draft an ADR in a
  session.
- `assets/adr-template.md` -- the exact document structure to produce,
  including the fast-track Y-Statement alternative for small decisions. Use
  this verbatim as the shape of the output; don't improvise a different
  section layout.
- `references/investigation-and-splitting.md` -- how to investigate the
  codebase before drafting, and how to recognize when a request is actually
  several decisions bundled into one. Read this before starting the
  investigation step below.

Where a judgment call comes up that these three files don't answer, general
software-engineering judgment is fine for pure mechanics (how to phrase a
sentence, how to format a table); for anything about what the *process*
requires -- what counts as significant enough, what the record must contain,
how numbering and status work -- these files are the standard, not general
ADR folklore from elsewhere.

## Workflow

### 1. Understand the idea -- don't accept a one-line request as sufficient

An ADR needs, at minimum, a real problem statement, a real set of considered
options, and real reasoning for the choice. If the user's request already
contains all of this in enough detail, don't force a redundant round of
questions just to follow a script -- move on. But if any of it is missing
(most commonly: only one option is mentioned, or the "why" is asserted
without the trade-off that ruled out the alternative), ask before drafting.
In particular:

- If only one option is described, ask what else was considered -- or
  investigated and ruled out early -- before treating it as a single-option
  decision. `adr-guidelines.md` and the template both treat "Considered
  Options" as a real requirement, not decoration; a future reader needs to
  see what was actually on the table. If the user genuinely only considered
  one option (no real alternative existed), that's a legitimate answer -- say
  so in the document rather than inventing a straw-man alternative to fill
  the section.
- If the reasoning is a conclusion without a mechanism ("it's more
  scalable," "it's cleaner"), ask what that means concretely for this
  decision, per the guideline's explicit warning against vague
  justification.

### 2. Investigate the codebase

Read `references/investigation-and-splitting.md` for the full detail. In
short: find the existing decision log (if any) to determine the next ADR
number and any decisions this one supersedes or relates to, and separately
investigate whatever part of the codebase is actually relevant to this
decision (dependencies, interfaces, current structure, existing
non-functional posture) so the Context and Consequences sections describe
the real system rather than a generic one. Cite what you actually find; if
the codebase doesn't have visible context for some part of the decision, say
so rather than filling the gap with plausible-sounding invented detail --
the same fabrication risk applies here as it does to the user's side of the
information.

### 3. Check significance, and offer the right format

Not every decision belongs in a full ADR. Check the decision against
`adr-guidelines.md`'s "When to write one" criteria (structure, non-functional
characteristics, dependencies, interfaces, construction techniques) and its
anti-patterns list:

- If the decision clearly hits one or more of those criteria and is
  substantial, proceed with the full template.
- If it's real but small or not yet contested enough to justify the full
  document, offer the template's Y-Statement fast-track instead, and mention
  it can be promoted to a full ADR later if it turns out to matter more than
  expected -- this is exactly what the guideline recommends for this case,
  not a lesser substitute.
- If it doesn't seem to hit any of the criteria at all (a routine
  configuration change, a decision with no real lasting consequence), say so
  plainly and ask whether they still want a record of it, rather than
  quietly manufacturing significance to justify a document. This is the
  first anti-pattern's mirror image -- forcing an ADR that shouldn't exist
  clutters the log the same way skipping a real one erodes it.

### 4. Check whether this is actually multiple ADRs

Read the splitting guidance in `references/investigation-and-splitting.md`.
If the decision bundles genuinely separable choices -- different axes of
significance, consequences that don't rise and fall together, pieces that
could plausibly be superseded independently later -- say so explicitly and
propose the split before drafting, rather than writing one large document or
silently picking a single thread to document. If the user confirms the
decisions really are inseparable in their context, respect that; the
heuristic is a prompt for a judgment call, not an override of the user's
own knowledge of their situation.

### 5. Draft the ADR

Use `assets/adr-template.md` exactly. In particular:

- **Context and Problem Statement**: neutral and descriptive, not a pitch for
  the option that won -- per the guideline, a future reader should be able to
  reach the same conclusion independently.
- **Considered Options**: every option seriously evaluated, from step 1.
- **Decision** and **Rationale**: name each rejected option and the specific
  trade-off that ruled it out -- not a generic "it's better" for the winner.
- **Consequences**: Positive, Negative, and Risks/Unknowns all filled in
  honestly -- a decision with no real negatives or risks is a sign the
  investigation or the interview stopped too early, not a genuinely
  consequence-free choice.
- **Related Decisions**: filled in from what you found in step 2 (supersedes,
  superseded by, related), not left as empty placeholders when a real
  relationship exists.
- **Status**: default to `Proposed` unless the user says the decision is
  already settled/accepted. Note in the handoff (step 7) that once a status
  moves to `Accepted`, the guideline treats the ADR as immutable -- future
  changes need a new ADR that supersedes this one, not an edit to this file.

### 6. Determine the number and file path

From the investigation in step 2: find the repo's decision log directory (or
confirm none exists), take the highest existing ADR number, and use the next
one in sequence -- never reuse a number, including for a rejected or
deprecated decision. If no decision log exists yet, create `docs/adr/` (the
guideline's suggested convention) and mention -- as an offer, not an
automatic action -- that the conventional first entry in a brand-new log is
an ADR documenting the decision to use ADRs at all, per the guideline's
"Getting started" section.

### 7. Write the file and hand off

Write the finished ADR as `ADR-<NNNN>-<short-slug>.md` in the decision log
directory. In your handoff to the user, state plainly: the file path and
number used, whether this is a full ADR or a Y-Statement, any split you
flagged (and whether the user asked you to proceed with one document
anyway), any existing ADR this one supersedes or relates to, and a reminder
that review here works like code review -- per the guideline, open it as a
pull request and get sign-off from whoever's affected before treating the
status as more than `Proposed`.

# Investigating the codebase, and when to split into multiple ADRs

Neither `adr-guidelines.md` nor `adr-template.md` spells out mechanics for
these two things, but both follow directly from the principles they do state.
This file exists to make those principles concrete and actionable.

## Why investigate before drafting

`adr-guidelines.md` is explicit that the Context section should let "a future
reader reach the same conclusion independently, not just accept yours" and
that the Rationale should avoid "vague justifications" like "it's more
scalable" without saying what that means *for this decision*. Neither of
those is possible from the user's description of their idea alone -- a
"we're deciding whether to add a message queue" conversation is missing the
actual forces at play (what's already in the codebase, what it would
displace, what it would need to integrate with) until you go look. Treat the
investigation as the difference between an ADR that reads as a genuine,
falsifiable account of the decision and one that reads as a plausible-sounding
essay -- the guidelines' whole premise (durable historical record, future
readers, avoiding re-litigating settled debates) depends on the former.

## What to actually look for

Two categories, both worth doing before drafting -- don't skip straight to
writing once the user has described their idea:

**1. The decision log itself.** Look for an existing ADR directory (commonly
`docs/adr/`, but check for variants like `doc/adr/`, `docs/decisions/`,
`architecture/decisions/` before assuming none exists). If one exists:
- Read enough of the existing ADRs (at minimum their titles/status/dates) to
  find the highest current number -- the new one is next in sequence, and
  numbers are never reused per the guideline, so don't guess a number without
  actually checking.
- Look for any existing ADR this new decision might **supersede** (a prior
  decision on the same topic being reversed or replaced) or that's simply
  **related** (touches the same component/interface/dependency). Flag
  candidates to the user rather than silently assuming a relationship --
  they know the history better than a keyword match does, but a match is
  worth surfacing.
- Notice the existing ADRs' own conventions (heading style, level of detail,
  whether they use the Considered Options section) and stay consistent with
  them rather than introducing a visibly different format mid-log.
- If no ADR directory exists at all, that's worth naming to the user --
  per the guideline's "Getting started" section, the conventional first entry
  in a new log is an ADR documenting the decision to use ADRs at all. Don't
  create that automatically or assume they want it; mention it as an option
  once you're about to create the very first real ADR in a repo that has
  none.

**2. The actual codebase context for this decision.** What to look for
depends entirely on what the decision is about, but the general shape is:
find the code, config, or docs that the forces and consequences sections need
to be concrete rather than generic. Examples:
- A decision about a new dependency or library: check what's already in the
  manifest (`package.json`, `pyproject.toml`, `go.mod`, etc.) for overlap,
  conflicting choices, or version constraints that are themselves a force.
- A decision about an interface or API contract: find the current interface
  definition and its existing consumers -- the blast radius of a breaking
  change is a real consequence, not a hypothetical one.
- A decision about structure (e.g. splitting a service, adopting a pattern):
  look at the current module/package layout to describe the "as-is" honestly
  in the Context section.
- A decision about a cross-cutting non-functional concern (security,
  availability): check for existing config, middleware, or docs that already
  encode a related posture, so the ADR doesn't contradict something already
  decided elsewhere without noticing.

Cite what you actually found (file paths, existing patterns) in the drafted
ADR rather than writing generically -- that's what turns "it's more secure"
into a real, falsifiable statement. If the codebase doesn't have any of this
context available (e.g. a genuinely greenfield decision, or the relevant
detail simply isn't visible from what's checked), say so rather than
inventing plausible-sounding technical detail to fill the section.

## When one ADR should become several

The guidelines' framing -- "one short, dated file per architecturally
significant decision" -- implies the reverse of what it says explicitly:
a single ADR bundling several genuinely separable decisions works against the
whole point of the format (a future reader trying to understand *one*
decision has to wade through others; a later change to just one of them has
no clean file to supersede). Watch for these signals that a request is
actually asking for more than one ADR:

- **The decisions don't share a single set of consequences.** If accepting
  one part and rejecting another is a coherent, plausible outcome (e.g. "use
  microservices AND adopt gRPC for inter-service calls AND move to
  trunk-based development"), they're separable -- a team could reasonably
  agree on the first and still be debating the second.
- **They land on different axes from the guideline's "when to write one"
  list** (structure / non-functional characteristics / dependencies /
  interfaces / construction techniques). A request that touches three of
  those axes for reasons that aren't actually coupled is a strong split
  signal; touching several axes *because they're genuinely one decision*
  (e.g. adopting a framework that dictates both structure and testing
  approach as a package) is not -- use judgment about whether the axes are
  incidentally bundled or truly inseparable.
- **One part could be superseded later without touching the other.** If it's
  plausible that six months from now only one part of the bundle gets
  revisited, that's a sign they were never really one decision.

When you see this, don't just proceed with one large ADR -- tell the user
explicitly, name the proposed split (e.g. "this reads like three ADRs: one
for X, one for Y, one for Z"), and ask whether they want them split before
you draft, or whether they've deliberately bundled them because they really
are inseparable in this case (sometimes they are, and the user's context
beats a heuristic). Don't silently pick one option -- this is exactly the
kind of judgment call worth surfacing rather than resolving unilaterally,
same as the significance gate below.

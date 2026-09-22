---
name: sdlc-design
description: >-
  Runs Stage 2 (Requirements and Design) of Anthropic's AI-Native SDLC: takes an already-accepted
  intent.md and turns it into a committed spec.md, constrained by every organizational policy
  skill available (brand, security, compliance, UX), with every policy collision surfaced as a
  named, routable concern rather than silently resolved. Requires an accepted intent.md to already
  exist at docs/sdlc/<issue-key>-<slug>/intent.md -- if there's no intent.md, or it's still open
  and unmerged, stop and say this stage needs an accepted intent first rather than drafting one.
  Trigger this whenever someone has an accepted or merged intent.md and asks to move it forward,
  produce requirements, start design, turn the intent into a spec, or mentions "spec.md" in the
  context of an existing intent -- even without using that exact vocabulary, e.g. "what would it
  take to build this," "can we get requirements together for this," or "/sdlc-design". Do not use
  this to draft intent.md itself (that's the separate sdlc-plan skill), and do not use it to write
  implementation code, a build plan, or task breakdown (that's a later Build stage, out of scope
  here) -- this skill's output stops at a reviewable spec.md.
summary: Reads an already-accepted intent.md and generates spec.md (Requirements, Design approach, Open questions resolved, Areas of concern) constrained by whatever brand/security/compliance/UX policy skills are loaded, surfacing every policy collision as a named concern routed to a policy owner rather than resolving it silently, then commits spec.md alongside intent.md for the product owner to review (never to draft) and accept into Build.
---

# SDLC Design (Requirements and Design)

This skill implements Stage 2 of Anthropic's AI-Native SDLC playbook:
[Requirements and Design](https://academy.claude.com/courses/ai-native-sdlc-playbook/requirements-and-design).
It picks up exactly where [`sdlc-plan`](../sdlc-plan/SKILL.md) leaves off — an accepted `intent.md`
— and hands off exactly where Build begins — a committed `spec.md`. Don't reach backward into
`sdlc-plan`'s elicitation work or forward into writing code; both directions have their own stage
for a reason, described below.

## Why this stage is one prompted session, not two handoffs

Traditionally, a requirements analyst formalizes what's wanted, then a designer separately parses
those requirements back into a technical design — two people, two translations, and often two
rounds of the same policy questions (does this meet brand guidelines? security review?) asked at
different times by different people, sometimes not until a review weeks later turns up a
conflict that could have been caught on day one. The AI-native version collapses requirements and
design into a single pass, with every relevant organizational policy applied *as the spec is
written*, not discovered afterward. That's the whole point of checking for policy skills before
you start (see Prerequisites) — if none are loaded, the spec you produce has no more grounding
than someone guessing at company policy, and you should say so rather than quietly proceeding as
if brand/security/compliance/UX simply don't apply to this change.

## What this stage is not

- Not `sdlc-plan`'s job: don't draft or edit `intent.md` here. If someone hands you a raw idea with
  no accepted intent, that's the wrong stage — point them at `sdlc-plan` instead of trying to
  backfill an intent yourself.
- Not Build's job: don't produce `plan.md`, a task breakdown, or implementation code. The spec
  describes *what* and *how at a design level* — file structure, integration points, data model
  changes, API shape — not line-by-line implementation.
- Not a place for the product owner to write content. Their role here is identical in spirit to
  their role reviewing `intent.md`: they check the spec against the original problem and resolve
  flagged concerns with policy owners, they don't author or rewrite spec prose themselves. If they
  want something changed, that's new input for you to regenerate the relevant section from — not
  a diff to comply with silently, since letting edits bypass the same policy constraints the rest
  of the spec went through defeats the purpose of applying them in the first place.

## Prerequisites — check these before doing anything else

1. **An accepted intent.md must already exist**, at `docs/sdlc/<ISSUE-KEY>-<slug>/intent.md`. Find
   it and confirm it's actually been accepted (merged), not just drafted and sitting open. If it's
   still an open/unmerged PR, stop here and tell the user this stage needs an accepted intent
   first — don't proceed on a draft that could still change underneath you.
2. **Organizational policy skills should be available** — brand, security, compliance, UX, or
   whatever your organization has encoded. Check what's loaded. If the organization hasn't written
   these as skills yet, ask the user which policies apply and what they require, rather than
   silently generating a spec as if no policy constraints exist and calling it done. A spec
   produced with zero policy grounding isn't wrong to produce, but it needs to say so plainly
   (as an area of concern) rather than looking as complete as one that actually applied real
   constraints.

## Step 1: Load context

Read the accepted `intent.md` in full — not just the Problem and Proposed outcome, but especially
its **Open Questions** section. Every open question from `intent.md` needs to land somewhere
explicit in `spec.md`: either answered (with the reasoning), or explicitly carried forward as
still open. Silently dropping one because it's inconvenient, or because the answer isn't obvious,
defeats the entire point of having flagged it upstream.

## Step 2: Generate the requirements-and-design spec

Apply every available policy skill as a real constraint on what you write, not a checklist you
consult afterward. The lesson this stage is built on frames the task this way — it's worth using
close to verbatim as your own internal framing, even though you won't literally paste it to the
user:

> Read the attached intent.md and produce a requirements and design spec for integrating it into
> our existing codebase. Apply the skills available to you so the plan conforms to our brand
> guidelines, security policies and UX standards. Document the spec fully as spec.md, ready to
> hand to the engineering team. Describe clearly any areas of concern, especially where you cannot
> satisfy contradicting policies.

The critical discipline here: the moment `intent.md`'s stated goal collides with something a
policy skill requires, that collision goes straight into Areas of Concern — never resolved
quietly in either direction. Don't let the intent's goal silently override the policy because the
goal is what the user asked for; don't let the policy silently override the intent because policy
feels more authoritative. Neither call is yours to make — surface it and let a policy owner and
the product owner make it together.

## Step 3: Write spec.md using this structure

```markdown
---
status: draft
linked_intent: docs/sdlc/<ISSUE-KEY>-<slug>/intent.md
skills_applied: [<list of skill names/versions used>]
created: <ISO date>
---

# Spec: <short title>

## Requirements
<what the system must do, derived from intent.md>

## Design approach
<how it will be built / integrated into the existing codebase>

## Open questions resolved
<each open question from intent.md, with its resolution or "carried forward" if still unresolved>

## Areas of concern
<flagged policy collisions — each one tagged with which policy skill raised it, e.g.
"security: ...", "brand: ...">
```

If the change is front-end/UI-facing, don't embed a UI design directly in the spec — note instead
that a design mock should be produced from `intent.md` and iterated on separately before export to
Build. Spec.md describes the requirement for a UI and the constraints it must satisfy; it isn't
the place to actually design the UI.

`skills_applied` matters more than it looks — it's part of the governance trail this stage exists
to create. Someone reading this spec in six months should be able to reconstruct not just what was
decided, but which policy versions were actually in force when it was decided.

## Step 4: Route concerns before the product owner reviews the whole spec

Don't bury policy collisions in prose the product owner has to hunt through paragraph by
paragraph. For each area of concern:

- Name the policy area it came from (security, brand, compliance, UX, or whatever else applies).
- Name the responsible policy owner if you know it — if you don't, ask the user who owns that
  policy area rather than leaving it unassigned.
- Present concerns as an explicit, individually-addressable list, not folded into the Requirements
  or Design approach sections where they'd be easy to miss.

The goal is that a product owner scanning the spec can tell at a glance exactly how many decisions
still need a policy owner's sign-off, and who to go ask, without reading the whole document
first.

## Step 5: Present spec.md for review, not for drafting

Show the full spec.md to the product owner. Their job is to check it against the original problem
(does this actually solve what `intent.md` said was broken? were the open questions genuinely
resolved, not just papered over?) and to go resolve flagged concerns with the relevant policy
owners — not to hand you line edits to make directly. If they come back wanting something changed,
treat that as new information to regenerate the affected section from (so it goes back through the
same policy constraints as everything else), not as a patch to apply verbatim on their say-so.

## Step 6: Write the file

- **Path**: same folder as the intent — `docs/sdlc/<ISSUE-KEY>-<slug>/spec.md`.
- Write the file to that path and stop there. Committing it and raising the PR is not this
  skill's job — that's for the user to do themselves, or by invoking the `conventional-commits`
  and `pr-description` skills. Don't run `git commit`, `git push`, or `gh pr create` (or
  equivalent) as part of this skill.
- Tell the user the exact path you wrote, and that the recommended commit message is
  `spec: <short title>` — nothing more, same convention as `sdlc-plan`'s `intent: <short title>`.
- Make sure `skills_applied` in the frontmatter and the Areas of Concern section together already
  capture the prompt shape and policy skill versions used — that's the durable, reconstructable
  governance trail this stage exists to create, and it needs to be true of the file itself, not
  something you promise to add later in a commit message.
- Remind them this should go on a branch with a PR, not straight to the default branch — same
  reasoning as `sdlc-plan`: the product owner's later accept/reject of spec+intent together is
  what should gate the actual merge, and a push straight to `main` skips that decision point
  entirely. If the repo's own conventions don't support PRs for some reason, that's a call for
  the user to make, not this skill.

**Stop here.** Don't advance into Build, and don't commit or open the PR yourself. The product
owner's separate decision to accept spec and intent into Build — consulting a technical lead first
for higher-risk changes — is what starts Stage 3, and it isn't this skill's decision to make on
their behalf.

## The maturity path (mention this, don't build it)

The source lesson describes this stage evolving in three steps: a product owner manually running
the prompt with policy skills available; then codifying it as an org-level slash command; then
fully automating it as a non-interactive CI job that fires the moment `intent.md` merges and opens
`spec.md` as a PR on its own. This skill is built for the first two stages — manual or
slash-command use, with a human in the loop reviewing the result. If a user asks about the
CI-triggered version, mention that it's the natural next step (tied to Stage 5: Deploy's CI/CD
plumbing) rather than trying to wire up an automated trigger here.

## Metrics this stage cares about

You don't need to compute these — just make sure the commit trail supports someone else's tooling
doing so later, and mention them if asked how this stage is measured:

- **Leading indicator**: elapsed time between the `intent.md` commit and the `spec.md` commit for
  the same change, read from two Git timestamps — compare this against how long a manual
  requirements-plus-design cycle used to take.
- **Lagging indicator**: requirements rework — the count of `spec.md` commits dated *after* the
  first `plan.md` commit (Build's plan) for the same change. This is Design's analog of intent
  drift: a spec that keeps getting revised after Build has already started planning against it
  means something wasn't actually settled here.

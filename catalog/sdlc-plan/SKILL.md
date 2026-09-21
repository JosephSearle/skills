---
name: sdlc-plan
description: >-
  Runs Stage 1 (Capture Intent) of Anthropic's AI-Native SDLC: turns a raw feature idea, problem,
  or "we should really fix X" into a committed intent.md that a product owner can accept into
  Design or reject. Interviews the originator -- anyone with an idea, not necessarily an engineer
  -- in their own words, keeps asking the scope/users/constraints/success-criteria questions an
  analyst would ask until the answer is concrete rather than guessing on their behalf, gets the
  idea linked to a GitHub issue or Jira ticket (offering to create one if a connector is
  available), drafts intent.md against an exact template, and always shows it back to the
  originator for correction before committing it to docs/sdlc/<issue-key>-<slug>/intent.md via a
  reviewable PR. Trigger this whenever someone describes a new feature idea, a problem they want
  turned into a formal proposal or spec input, something to hand to a product owner or engineering
  team, or explicitly says "/sdlc-plan", "start a plan doc", "capture this as intent", or mentions
  "intent.md" by name -- even if they haven't used any of that vocabulary and just started
  describing what's broken and what they wish existed instead. Do not use this for a bug report
  with no design implications, a small fix, or anything already at the spec/design stage.
summary: Interviews an originator (any idea-haver, not necessarily an engineer) about a feature idea until scope, affected users/systems, constraints, and success criteria are all concrete, links it to a GitHub or Jira issue, drafts an exact intent.md template, gets explicit sign-off on the draft, and commits it via a reviewable PR to docs/sdlc/<issue-key>-<slug>/intent.md -- implementing Stage 1 (Capture Intent) of Anthropic's AI-Native SDLC.
---

# SDLC Plan (Capture Intent)

This skill implements Stage 1 of Anthropic's AI-Native SDLC playbook:
[Capture Intent](https://academy.claude.com/courses/ai-native-sdlc-playbook/capture-intent). Read
that lesson's own framing if you want the fuller philosophy; the short version is the reason this
stage exists at all.

## Why this stage exists

In a traditional process, an idea passes through several people before it becomes a ticket
engineering actually reads — and at each handoff, ownership (and a little bit of meaning) transfers
away from the person who actually had the idea. What reaches engineering is several steps removed
from what the originator meant. The AI-native alternative skips the relay: the **originator** —
whoever had the idea, whether or not they can write a line of code — talks directly to Claude in
their own words, and Claude does the elicitation work an analyst or PM would normally do by hand.
The output, `intent.md`, is the originator's own proto-spec, not someone else's translation of it.

An intent can start from any of three places — a person's idea, a ticket someone already filed, or
an incident/alert that surfaced a problem — and all three go through the same conversation and the
same review gate before they're committed. Don't treat a filed ticket or an incident as needing
less interview than a from-scratch idea; the point of this stage is to settle what's actually
being asked for, regardless of how it arrived.

**Keep the conversation informal.** No formal language is required from the originator, and you
shouldn't demand it either. This is a conversation, not a form to fill in — accept partial or messy
input and work with it.

## What this stage is not

- Not spec.md, architecture, or acceptance criteria — that's Stage 2: Design, and it's out of
  scope here. If the conversation starts drifting into "here's exactly how we'd build it," that's
  a sign the idea may already be past this stage — flag it, but still finish capturing the intent
  cleanly rather than half-drafting a design.
- Not for a bug report with no design implications, or a small fix with no real scope to capture.
- Not a place to guess on the originator's behalf. Where you don't know something, that's an open
  question, not a guess dressed up as an answer.

## Step 1: Elicit the problem, in the originator's own words

Ask what they can't do today, who's affected, what "better" looks like, and what's explicitly out
of scope. Don't insist on precision yet — this first pass is meant to be rough. If they've already
said most of this in their initial message, don't make them repeat it; acknowledge what you heard
and move straight to sharpening it in Step 2.

## Step 2: Brainstorm until concrete

This is the heart of the skill, and it's iterative — plan on more than one round of questions.
Keep going, asking the questions an analyst would ask, until you can answer all four of these
without inventing anything:

- **Scope**: what's explicitly in, what's explicitly out.
- **Users and systems affected**: who feels this pain, and which parts of the architecture it
  touches.
- **Constraints**: hard limits — compliance, security, "existing auth only," "no new
  dependencies," anything that isn't negotiable.
- **Success criteria**: what "done" looks like, concretely enough that someone could later check
  whether it happened.

The failure mode to avoid is stopping after one round because you have *something* to put in each
section. A one-line scope statement or a vague "engineering team" for affected systems usually
means there's another question to ask. Push a little further before accepting an answer as
settled — but the moment the originator says "I don't know" or "we haven't decided," that's a
legitimate answer: write it down as an open question in Step 4 rather than pressing for a decision
that isn't theirs to make yet, or guessing at one yourself.

## Step 3: Get it linked to an issue

Before drafting, the intent needs a home: a GitHub issue number/URL or a Jira key.

- If the user already has one, just take it.
- If they don't, and a GitHub or Jira/Atlassian connector is available in this session, offer to
  create the issue yourself and link back to it — don't make them go create it manually if you can
  do it directly.
- If no connector is available, ask them to paste the issue key or URL.
- If they genuinely don't have one yet and can't get one right now, don't stall the whole
  conversation over it — proceed with `linked_issue: TBD` and say plainly that it'll need filling
  in before this is ready to hand off. Never invent an issue key to make the template look more
  complete than it is.

## Step 4: Draft intent.md and get it corrected

Use this exact template — don't add sections, don't drop any, and don't fill in the frontmatter
with anything not covered above:

```markdown
---
author: <name>
status: draft
linked_issue: <issue key or URL, or TBD>
created: <ISO date>
---

# Intent: <short title>

## Problem
<what's broken today, described concretely>

## Proposed outcome
<what better looks like>

## Affected users and systems
<who is impacted, which systems/architecture areas are touched>

## Constraints
<hard limits — compliance, security, existing auth only, no new deps, etc.>

## Open questions
<anything genuinely unresolved — flag it here rather than guessing>
```

Show the full drafted document to the originator and explicitly ask them to correct anything
you've misunderstood before going further — this step is not optional, and it's not enough to
just mention the draft is ready. The whole value of this stage is that the intent stays theirs;
skipping the correction step defeats the purpose even if the draft looks right to you.

## Step 5: Commit it

Once the originator has signed off:

- **Path**: `docs/sdlc/<ISSUE-KEY>-<kebab-case-slug>/intent.md` — e.g.
  `docs/sdlc/ITZ-22065-mlflow-observability/intent.md`. If there's no issue key yet, use
  `docs/sdlc/TBD-<kebab-case-slug>/intent.md` and say it should be renamed once a real key exists.
- **Commit message**: `intent: <short title>` — nothing more. Author and timestamp live in the
  Git commit metadata itself; don't restate them anywhere as if the file were the source of truth
  for who wrote it or when.
- If a version-control tool is available (`gh`, a Git remote reachable from a shell, a connected
  GitHub/GitLab integration), commit the file on a branch and open a PR rather than pushing
  straight to the default branch — the whole point of committing this way is that the product
  owner's later accept/reject decision *is* the merge (accept) or the closed/rejected PR (reject).
  A push straight to `main` skips that decision point entirely. If the repo's own conventions
  don't support PRs for some reason, follow local convention rather than fighting it.
- If no version-control tool is available at all, write the file locally and tell the user the
  exact path and exact commit message to use themselves — don't skip creating the file just
  because you can't commit it.

You don't need to do anything about the actual accept/reject decision — that happens later, by
someone else, as an ordinary PR review. Your job ends at making sure the artifact is structured to
support that review.

## Metrics this stage cares about

You don't need to compute these — just structure the commit/file so someone else's tooling could,
and mention them if the user asks how this stage is measured or "is this actually working":

- **Leading indicator**: time from the first conversation to a committed `intent.md`, read
  straight from Git history (the commit's author + timestamp). The whole point of this stage is
  that this should be hours, not the multi-week elicitation-and-refinement cycle a traditional
  process produces — if a single intent is dragging across days of back-and-forth, that's worth
  noting to the user, not just pushing through.
- **Lagging indicator**: survival rate — the share of `intent.md` files a product owner merges
  into Design versus closes/rejects — plus how many times an `intent.md` gets edited *after* the
  first `spec.md` commit for the same change. Repeated post-handoff edits are a proxy for intent
  drift: requirements that weren't actually settled before the handoff, which is exactly what a
  thorough Step 2 is meant to prevent.

## A note on originator diversity

The originator might be a PM, a support lead relaying a customer pattern, an engineer who noticed
something while working on unrelated code, or anyone else with an idea. Don't assume engineering
vocabulary or make them translate their idea into ticket-speak before you'll engage with it — the
translation work is yours to do, not theirs.

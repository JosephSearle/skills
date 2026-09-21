# OWNERS files vs. CODEOWNERS: why the two-tier split exists, and what it looks like

Read this when Step 1's two-tier trust question comes back "yes, we actually want that split." It
explains what the team would be building, not this skill trying to fake it inside CODEOWNERS syntax
(which has no way to express it).

## The lineage

Chromium's `OWNERS` files came first. Kubernetes adopted and extended the idea for its own
`OWNERS`/`OWNERS_ALIASES` system, still in active use across the Kubernetes project today. GitHub's
`CODEOWNERS` came later and is a deliberately *simpler* descendant of both -- it kept the core idea
(ownership expressed as data, checked at review time) and dropped several capabilities Kubernetes'
version has, in exchange for something that needs no bot, no CI job, and no separate tooling to work
-- it's native to GitHub's PR review-request mechanism.

## What Kubernetes' OWNERS has that CODEOWNERS doesn't

- **Two distinct trust levels, not one.** `reviewers:` lists people who can review and signal
  familiarity with the code; `approvers:` lists people who can actually approve a PR for merge.
  These are different bars -- a wider set of people can meaningfully review something than should be
  trusted to approve it for merge. CODEOWNERS has exactly one role: "owner," full stop. Everyone
  listed for a path is being asked the same thing (a requested review), with no way to also say "but
  only *these* people's approval actually counts toward merging."
- **`emeritus_approvers`.** Departed maintainers are moved here explicitly rather than just deleted
  from the file or silently left in `approvers:` where they'd keep blocking merges (if required) or
  keep getting requested (if not). This is documentation of history as much as a functional list --
  it records who used to hold that trust level without either pretending they still do or erasing
  that they once did.
- **Pattern-based auto-labeling.** An OWNERS-adjacent config can attach a label automatically based
  on which files changed (a `go.mod` change gets `area/dependency`, a `metrics.go` change gets
  `sig/instrumentation`) -- a side effect CODEOWNERS has no mechanism for at all.

## What this means practically, if a team wants it

There is no CODEOWNERS syntax that creates a second trust tier -- don't reach for a workaround like
"list approvers first" or "use a comment to mark who can really merge." The honest options are:

1. **Layer GitHub branch-protection rules on top of CODEOWNERS.** CODEOWNERS still handles routing
   (who gets requested), and a branch-protection rule can separately require an approval from a
   specific, narrower team before merge is allowed -- effectively creating an approver tier above
   the general CODEOWNERS reviewer tier, using GitHub-native mechanisms rather than a second system.
   This is usually the right first thing to try, since it needs no extra tooling.
2. **A bot-driven OWNERS-style system**, either by adopting `prow`-style tooling (as Kubernetes
   itself does) or a lighter equivalent, if the team's needs genuinely go beyond what
   branch-protection-plus-CODEOWNERS can express (e.g. they specifically want the auto-labeling
   behavior too, or `emeritus_approvers`-style historical tracking).

Present this as a real fork in the road, not a footnote: if the team picks option 2, that's a
different, larger piece of tooling than "write a CODEOWNERS file," and worth being explicit that it's
now a different task.

---
name: sdlc-status
description: >-
  Reports where each change in the AI-Native SDLC series stands and the one next step for it: scans
  docs/sdlc/ISSUE-KEY-slug/ folders, uses git to tell whether intent.md, spec.md and plan.md are
  missing, drafted, awaiting acceptance (committed but unmerged) or accepted (merged), and names the
  skill to run next -- sdlc-plan, sdlc-design or sdlc-build -- or the commit/PR step that's
  blocking. Read-only: runs a bundled script and relays its answer; never drafts, commits or
  advances a stage itself. Trigger whenever someone asks where a change is at, what's next for an
  idea/spec/plan, which changes are in flight, whether something is ready for design or build, or
  says "/sdlc-status" -- even without that vocabulary, e.g. "what's the state of TASK-118" or "where
  did we get to with the CSV export". Not for writing intent.md, spec.md or plan.md (use sdlc-plan,
  sdlc-design, sdlc-build) or for anything after plan.md -- the series ends there.
summary: Scans docs/sdlc/ change folders with a bundled script, uses git to classify each intent.md, spec.md and plan.md as missing, drafted, awaiting acceptance or accepted, and reports each change's stage and the single next step (which SDLC skill to run, or which commit/PR is blocking) -- the read-only navigator for the sdlc-plan, sdlc-design and sdlc-build series.
---

# SDLC Status (where is each change?)

This is the navigator for the series [`sdlc-plan`](../sdlc-plan/SKILL.md) →
[`sdlc-design`](../sdlc-design/SKILL.md) → [`sdlc-build`](../sdlc-build/SKILL.md). Each of those
skills does one stage and stops; this one answers the question in between: *where is this change,
and what happens next?*

```
sdlc-plan   → intent.md  Stage 1  accepted when the product owner merges it
sdlc-design → spec.md    Stage 2  accepted when the product owner merges it
sdlc-build  → plan.md    Stage 3  committed before any code; then the team implements it
```

All three artifacts live in `docs/sdlc/<ISSUE-KEY>-<slug>/`, and acceptance at every stage is a
merge to the default branch, not a `status:` value in frontmatter (that records what a file was
when drafted, so don't trust it). That's what makes stage detection mechanical, which is why it's
a script rather than something to eyeball.

## What this skill is not

- **Not a stage of its own.** Don't draft, edit, or fix `intent.md`, `spec.md`, or `plan.md` here,
  even if the report makes the next step obvious. Name the skill that owns it and stop — the user
  decides when to start that stage.
- **Not a way to advance a stage.** Don't commit, push, open PRs, or merge anything. Acceptance is a
  product owner's (or approver's) decision; this skill reports whether it has happened.
- **Not past `plan.md`.** The series deliberately ends at a committed plan. After that, the only
  next step is implementing from `plan.md` — don't suggest test, deploy, or maintenance stages.

## Step 1: Run the script

```bash
python <this-skill-dir>/scripts/sdlc_status.py docs/sdlc
```

- If the repo has a remote, run `git fetch` first so merges on the remote are visible. The script
  checks the remote's default branch (`origin/HEAD`) when there is one, else local `main`, else
  `master`. Pass `--base <branch>` if the team's default branch is something else.
- Pass a different root if the user's change folders live somewhere other than `docs/sdlc`.
- If the user asked about one change, still run it for the whole folder and report just that one —
  it's one command either way.
- If Python isn't available (try `python3` too), do the same check by hand: for each file, `git log
  --oneline <base> -- <path>` non-empty means accepted, and say that you did it by hand.

Each artifact gets one of these states:

| State | Meaning |
|---|---|
| `missing` | the file isn't there |
| `uncommitted` | on disk, not in any commit yet |
| `committed` | committed on a branch, not merged to the base branch yet |
| `accepted` | on the base branch — merged, so that stage is accepted |
| `unknown` | on disk, but acceptance can't be read (not a git repo, or no base branch) |

Exit code `2` means the root folder doesn't exist: no change has been captured yet, so the next
step is `sdlc-plan`.

## Step 2: Relay the result

For each change (or just the one asked about), give its title, its stage, and the script's single
next step. Keep it as short as the script's output — this is a status check, not a report.

- **Name skills the way the user invokes them.** Installed through the `sdlc` plugin they're
  namespaced (`/sdlc:sdlc-design`); copied into `.claude/skills/` they're plain (`/sdlc-design`).
  Use whichever form this session actually has.
- **An `unknown` state is a question, not a verdict.** Say what couldn't be checked and ask the
  user to confirm, rather than assuming the stage was accepted.
- **Flag what the script can't see.** If a folder looks wrong — a spec or plan with no intent, a
  plan made straight from an intent with no spec — say so plainly; the script already labels those
  cases, so pass the label on rather than smoothing it over.
- If several changes are in flight, a one-line-per-change list is enough unless the user asks for
  detail.

Then stop. If the user wants to act on the next step, they'll invoke the skill it names.

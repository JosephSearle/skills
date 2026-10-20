---
name: sdlc-build
description: >-
  Runs the plan-mode play of Stage 3 (Build) of the AI-Native SDLC: turns an accepted spec.md and
  its intent.md into plan.md before any code is written. Works read-only (plan mode) against the
  real codebase; drafts the files that change, an order of work whose steps cite the spec's
  numbered requirements, risks mapped to the spec's areas of concern, proof (tests/checks) for
  every requirement, and alternatives not taken; probes it for breakage and the riskiest step until
  someone who never saw the conversation could implement from it. Requires a merged spec.md at
  docs/sdlc/ISSUE-KEY-slug/ -- if missing or unmerged, stop and say so. Trigger whenever someone
  has an accepted spec and wants to plan the build, start implementing it, "plan this out", asks
  how to build a spec'd change, or says "/sdlc-build" -- even without that vocabulary. Not for
  drafting intent.md (sdlc-plan) or spec.md (sdlc-design); it stops at plan.md, and implementation
  starts only once the plan is approved and committed.
summary: Reads an accepted spec.md and intent.md, explores the codebase read-only in plan mode, and writes plan.md (Files that change, Order of work citing numbered requirements, Risks mapped to spec concerns, Proof per requirement, Alternatives not taken), probing it until a stranger could implement from it, classifying it routine or higher-risk for the right approver, and checking requirement coverage with a bundled script -- implementing the plan-mode play of Stage 3 (Build) of Anthropic's AI-Native SDLC.
---

# SDLC Build (Plan mode → plan.md)

This skill implements the plan-mode play of Stage 3 of Anthropic's AI-Native SDLC playbook:
[Plan mode](https://academy.claude.com/courses/ai-native-sdlc-playbook/plan-mode). Its headline
rule is the thing to keep in mind throughout: **nothing is implemented without an accepted plan.**

## Where this sits in the series

```
sdlc-plan   → intent.md  Stage 1: what's wanted, in the originator's words
sdlc-design → spec.md    Stage 2: numbered requirements R1..Rn, design, concerns C1..Cn
sdlc-build  → plan.md    Stage 3: files, order of work, risks, proof  ← this skill
              ↓ handoff: the team implements, tests, deploys and maintains it their own way
```

The series deliberately ends at `plan.md`. Plan, design and build look the same for any project:
they prepare an idea so a developer or team can build it. How that team then tests, deploys and
maintains it depends on the workload, so it's left to them. The one thing that carries past the
handoff is `plan.md` itself, as the record the eventual diff is reviewed against.

All three artifacts live side by side in `docs/sdlc/<ISSUE-KEY>-<slug>/`. Each stage reads the one
before it and cites it, so a reviewer can walk from a line of the diff back to a step in
`plan.md`, the requirement in `spec.md` it satisfies, and the problem in `intent.md` that started
it. That chain *is* the audit trail — keep every link in it explicit.

## Why this stage exists

Traditionally, an engineer's implementation plan lives in their head or a ticket comment, and
reviewers see it for the first time as a finished diff — the point where changing course is most
expensive. The AI-native version puts the written plan first: Claude reads the codebase without
changing anything, proposes a plan, the engineer interrogates and corrects it, and only the
approved plan is committed and implemented. Design review happens *before* code exists, and the
committed `plan.md` becomes the yardstick the eventual PR is checked against.

## What this stage is not

- **Not `sdlc-design`'s job.** Don't change requirements or rewrite `spec.md`. If planning against
  the real code shows the spec is wrong or unbuildable as written, say so and send it back to
  `sdlc-design` to regenerate — don't quietly plan something different from what was accepted.
  Spec commits made after the first `plan.md` are exactly the "requirements rework" Design is
  measured on, so they should be deliberate and visible, never accidental.
- **Not implementation.** No production code, tests, or config changes while planning. A short
  signature or interface shape is fine when it pins down a contract between steps; function bodies
  are not.
- **Not a place to settle policy questions.** An unresolved area of concern from the spec belongs
  to its policy owner, not to the engineer or to you.

## Step 1: Check prerequisites

1. **Find the change folder**: `docs/sdlc/<ISSUE-KEY>-<slug>/` containing `intent.md` and
   `spec.md`. If the user didn't name one and there are several candidates, ask which.
2. **Confirm `spec.md` is accepted** — merged to the default branch, not merely written. The
   `status` field in its frontmatter records what it was when drafted, so don't trust it; check
   git. For example: `git log --oneline <default-branch> -- docs/sdlc/<folder>/spec.md` (use
   `origin/<default-branch>` after a `git fetch` if there's a remote). No commits there means it
   hasn't been accepted: stop, tell the user Build starts when the product owner merges the spec,
   and don't draft a plan against a spec that can still change underneath it. If the repo has no
   branch/PR flow at all, ask the user to confirm the spec was accepted rather than assuming.
3. **No spec, only an intent?** The lesson allows planning straight from `intent.md` for small
   changes, but say plainly that the plan will have no numbered requirements to cite and recommend
   running `sdlc-design` first. Proceed only if the user agrees.
4. **Read `CLAUDE.md`** if the repo has one — it tells you the build, test, and lint commands the
   Proof section has to use. If there isn't one, note it (suggest `/init` afterwards) but don't
   block on it.

## Step 2: Work read-only

Until the engineer approves the plan, don't modify any file. In Claude Code that means plan mode:
if the session isn't already in it, enter it (EnterPlanMode, or ask the user to switch with
Shift+Tab). Outside Claude Code, hold yourself to the same rule. The point is that the plan gets
reviewed while there is nothing to unwind if it turns out wrong.

## Step 3: Load context

Read `intent.md` and `spec.md` in full, and pull out:

- **Requirements** — numbered `R1`, `R2`, … in specs written by current `sdlc-design`. If the spec
  predates numbering, number them yourself by order of appearance in its Requirements section and
  say so in the plan, so the citations stay checkable.
- **Areas of concern** — numbered `C1`, `C2`, …, each tagged with the policy skill that raised it
  and, where known, its owner and status (open, or resolved with a resolution). Same fallback if
  unnumbered.
- **Open questions the spec carried forward** as unresolved, and the intent's **Constraints**
  (plus the spec's table of how each is met, if it has one).
- **`skills_applied`** from the spec's frontmatter. Load those same policy skills if they're
  available — implementation choices (where a secret lives, how input is validated, what gets
  logged) must honor the same constraints the spec was written against.
- **UI mocks**: if the spec says a design mock should exist for a UI change, find it (or ask where
  it is) — Proof for those requirements needs a visual check against it.

Then explore the code that the spec's Design approach touches. Every path you put in the plan
should be one you've actually seen (Glob/Grep/Read) or one you explicitly mark as new. Invented
paths are the most common way a plan looks complete but can't be followed.

## Step 4: Draft plan.md

Use this structure:

```markdown
---
status: draft
linked_spec: docs/sdlc/<ISSUE-KEY>-<slug>/spec.md
linked_intent: docs/sdlc/<ISSUE-KEY>-<slug>/intent.md
linked_issue: <copied from intent.md>
risk: <routine | higher-risk>
approver: <engineer | tech lead | architect>
created: <ISO date>
---

# Plan: <short title>

## Files that change
**New**
- `path/to/new_file.ext` — what it's for

**Modified**
- `path/to/existing.ext` — what changes in it

## Order of work
1. <step, specific enough to act on> (R1, R2)
2. <step> (R3)

## Risks
- <what could break or go wrong> — <mitigation> (C2)
- <risk not tied to a spec concern> — <mitigation> (plan-level)

## Proof
- R1: <named test file/case or check> — `<exact command>`
- R2: ...

## Alternatives not taken
- <option considered> — <why not>
```

What each part is for:

- **Files that change** — the reviewer's map of the blast radius. Real paths only; new files
  clearly marked as new.
- **Order of work** — every step cites the requirements it satisfies in parentheses, so a reviewer
  can check the plan against the spec line by line. Order steps so the codebase is coherent after
  each one (tests can run between steps), and schedule the riskiest or most uncertain step early,
  while discovering a problem there is still cheap. A step with no citation is either scaffolding
  a later step needs (say which: "(scaffolding for step 4)") or scope creep (cut it).
- **Risks** — every area of concern in the spec gets at least one entry here, cited by its `C`
  number, even if only to say it's resolved and how the plan honors the resolution. **If a concern
  is still open, don't plan around it as if it were settled**: write
  `BLOCKED on C3 (<owner>): <what decision is needed>` and mark the dependent steps in Order of
  work with the same tag. Carried-forward open questions that the implementation depends on get
  the same treatment. Unblocked steps can still proceed; the plan just makes visible what can't.
- **Proof** — every requirement gets at least one concrete check: a named test (new or existing),
  a command from `CLAUDE.md` or the project's scripts, or a visual check against the mock for UI
  work. "Add tests" is not proof; "`npm test -- export.test.js` — empty, one-row, and 10k-row
  exports" is.
- **Alternatives not taken** — the lesson has the engineer ask which options Claude chose not to
  pursue. Writing the answers down stops a future reader from re-litigating them and shows the plan
  was a choice, not a default. One or two real alternatives beat a padded list.

## Step 5: Probe the plan, then let the engineer probe it

Before showing the plan, put the lesson's three questions to it yourself and fold the answers into
the draft (mostly into Risks and Alternatives not taken):

1. **What could this change break?** Callers of anything you're modifying, data already in
   production, behavior other features rely on.
2. **Which step is riskiest, and why?** Make sure it's visible in Risks, not buried mid-list.
3. **What alternatives did you reject?**

Then present the full plan to the engineer and invite them to push on it the same way. Expect more
than one round. Treat their corrections as information about the code and team you didn't have,
and after each change re-check the plan's consistency (citations still right? Proof still covers
every requirement?).

**The bar for done:** someone who never saw this conversation could implement the change from
`plan.md` alone. If a step only makes sense with context that lives in the chat, that context
belongs in the plan.

## Step 6: Classify risk and get the right approval

Propose a risk tier and have the engineer confirm it — what counts as higher-risk is the
organization's call, not yours, so ask when it isn't clear:

- **Routine** — the engineer approves the plan themselves.
- **Higher-risk** — a tech lead or architect approves before implementation starts. Signals worth
  raising: auth, payments, or personal data; schema or data migrations; public API changes;
  irreversible operations; any open or security/compliance-tagged area of concern; a wide blast
  radius across services.

Record the tier and the approving role in the frontmatter. Approval itself is a decision a person
makes — never record it as given on someone's behalf.

In Claude Code, presenting the finished plan for approval is the moment to exit plan mode
(ExitPlanMode). The engineer's acceptance there is their approval, and the first thing you do after
it is write `plan.md` (Step 7) — not start implementing.

## Step 7: Write plan.md and check coverage

- **Path**: same folder as the intent and spec — `docs/sdlc/<ISSUE-KEY>-<slug>/plan.md`.
- **Check coverage** with the bundled script (it lives in this skill's `scripts/` folder):

  ```bash
  python <this-skill-dir>/scripts/check_plan_coverage.py docs/sdlc/<ISSUE-KEY>-<slug>
  ```

  It verifies that every requirement in `spec.md` is cited by at least one step and at least one
  Proof entry, that every `R`/`C` the plan cites exists in the spec, that every area of concern
  appears in Risks, and that the plan has its required sections and frontmatter. Fix whatever it
  reports rather than explaining it away. If Python isn't available, do the same check by hand and
  say that you did.
- **Write the file and stop there.** Committing it and raising the PR is the user's job, or the
  `conventional-commits` and `pr-description` skills' — don't run `git commit`, `git push`, or
  `gh pr create` as part of this skill.
- Tell the user the exact path, and that the recommended commit message is `plan: <short title>` —
  the same convention as `intent:` and `spec:`.
- Tell them how it should land:
  - **Routine**: commit `plan.md` as the first commit on the implementation branch, before any
    code. The eventual PR then carries the plan and the diff together, and review checks one
    against the other.
  - **Higher-risk**: get the tech lead's or architect's approval on `plan.md` — a plan-only PR, or
    their review of that commit — before implementation begins.

## Step 8: Hand off to implementation

**Stop here.** Implementation is a separate step the engineer starts once the plan is committed.
When it happens — this session or a new one — these rules carry the plan's value into the code,
so state them in your hand-off:

- Implement from the committed `plan.md`, step by step, running each step's Proof as you go.
- **If the implementation has to diverge from the plan, update `plan.md` in the same commit as the
  diverging code.** A plan that no longer matches the diff is worse than none, because reviewers
  will trust it.
- If a divergence changes *what* gets built rather than *how*, that's a spec change: stop and route
  it back through `sdlc-design`.

## Legacy systems and source of truth

If the team also tracks this work in Jira, a requirements tool, Figma, or a change board, keep the
link explicit at minimum: `linked_issue` carries the external ID, and the external record should
get the commit SHA once `plan.md` is committed. Which side is authoritative is the team's call; if
it's the external system, read it at the start and treat `plan.md` as the working copy.

## The maturity path (mention it, don't build it)

As guardrails mature — a tuned `CLAUDE.md`, policy skills, hooks that block unsafe actions, a
runnable test suite — routine work with a tight spec and small blast radius can be implemented in
auto mode once the plan is approved, and several approved plans can run in parallel sessions in
separate git worktrees. Review then shifts from watching each edit to reviewing artifacts after
longer sessions, which is exactly why the plan has to be good enough to review against. A hook that
rejects commits where code changed outside the files `plan.md` lists, without `plan.md` changing
too, is the natural way to enforce the divergence rule. If a user asks about any of this, describe
it as the next step rather than wiring it up here.

## Metrics this stage cares about

You don't compute these; structure the artifacts so someone's tooling could, and mention them if
asked how this stage is measured:

- **Leading**: share of changes that merge on the first implementation pass, and time from plan
  approval (the `plan.md` commit) to merged PR.
- **Lagging**: rework cycles per change, and how often the merged diff still matches `plan.md` —
  which only means something if divergences were recorded in the plan as they happened.

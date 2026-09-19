---
name: issue-filing
description: 'Turns a rough, informal description of a bug or a piece of planned work (feature, task, tech debt, chore) into a well-formed GitHub issue -- title, scoped body, and metadata suggestions (labels, sub-issue/parent relationships, blocking dependencies) -- rather than designing the issue-template forms themselves (see the separate issue-template skill for that) or drafting a PR/CL description (a separate, unrelated skill). Applies Simon Tatham''s reproducibility-first reasoning to bug reports (steps to reproduce, expected vs. actual, environment, and a structural separation of observed fact from the reporter''s own speculation about the cause) and Bill Wake''s INVEST criteria as an actual quality gate to planned work (Independent, Negotiable, Valuable, Estimable, Small, Testable) -- not just a checklist to nod at. Runs a shared atomicity check before drafting either kind (is this secretly two issues bundled into one?), checks for likely duplicates before writing anything, and holds its own title to a concrete what/where/under-what-condition bar rather than accepting a vague first draft. Asks only what''s genuinely missing for the issue type at hand, not an exhaustive interrogation. Triggers on: "file a bug for this", "can you write up this issue", "turn this into a GitHub issue", "I found a bug -- can you draft the report", "we need an issue for this feature idea", "help me write a well-scoped ticket for this", "is this issue too big / does this need to be split up", or any request to turn a rough problem description or work idea into an actual GitHub issue (not the form/template the issue is filed against, and not a PR description).'
summary: Turns a rough bug report or feature idea into a well-formed GitHub issue -- title, body, and metadata -- via Tatham's bug-report reasoning or INVEST for planned work, after checking it's actually one issue and not already filed.
---

# Issue Filing Skill

This skill turns a rough description into one specific, well-formed GitHub issue. It is not the
skill that designs `.github/ISSUE_TEMPLATE/` forms (that's the sibling `issue-template` skill --
if the repo already has templates, this skill maps into them rather than inventing its own shape,
see Step 5) and it is not for writing a PR or CL description (a separate, unrelated skill covers
that).

## Before anything else: is this actually one issue?

Bug reports and planned work fail the same way from opposite directions: a bug report that bundles
two unrelated symptoms, and a feature description that's secretly two units of work, are the same
underlying problem -- an issue that will never have one clean "done," because closing it means two
different things happened, or an assignee has to solve two things to close one ticket. Run this
check first, before branching into either path below, since it applies identically to both:

- Does the description contain **two or more distinct symptoms/capabilities joined by "and," "also,"
  or a list** that don't share one root cause or one deliverable? ("The export button is broken and
  also the search is really slow" is two bug reports, not one.)
- Would **fixing/shipping half of this and not the other half still count as done**? If yes, that's
  a strong signal these are two issues, not one issue with two parts.
- For bugs specifically: **do the reported symptoms plausibly share one root cause**, or are they
  independent failures that happen to have been noticed in the same session? Two crashes in
  unrelated parts of the app aren't one bug just because the same person hit both today.
- For planned work specifically, this is also literally INVEST's **Small** criterion (see below) --
  don't wait until the INVEST pass to catch it if it's obvious immediately from the description.

If the description is really two (or more) issues, say so before drafting anything, and either draft
them as separate issues or ask which one to file first -- don't silently pick one and drop the other,
and don't draft one bloated issue that tries to cover both just to avoid the conversation.

## Step 1 -- Check before you draft: has this already been filed?

Real bug-report guidelines converge on a sequence that comes *before* writing anything: search for
existing or duplicate issues (including closed ones -- a bug "reported" against a version that's
already been fixed and released is still worth checking against closed issues) and any open PRs that
might already address it, and confirm the problem still reproduces against the current/latest version
before treating a stale report as live.

- If repo-search tooling is available (a `gh` CLI, a GitHub MCP connector, or direct repo access),
  use it to search issue titles/bodies for likely duplicates and check for an open PR that already
  fixes this, before drafting. Don't skip this because it feels like it slows things down -- a
  polished duplicate issue is strictly worse than no issue, since it now costs someone else the time
  to notice and close it. `references/github-commands.md` has the exact `gh` commands for this,
  including how to search closed issues (not just open ones) and open PRs.
- If no such tooling is available in this context, say so explicitly and ask the user to check
  first (or confirm they already have) rather than silently skipping the step. Don't draft a full
  issue and only mention afterward that nobody checked for duplicates.
- If a likely duplicate turns up, say so and ask whether the user wants to add to the existing issue
  instead of filing a new one, rather than proceeding to draft a second issue for the same problem.
- For bugs specifically, if the description mentions an older version or doesn't mention a version at
  all, ask (briefly, as part of the same round of questions in Step 3) whether it still reproduces on
  the current release -- an unreproducible-on-latest bug report sends people chasing something already
  fixed.

## Step 2 -- Ask only what's genuinely missing, and only once

Per Jono Bacon's guidance on issue quality: people filing issues have limited patience for an
interrogation. The goal is to extract the specific facts this issue type actually needs (see Step 3
below for exactly what that is per type), not to run through an exhaustive checklist.

- Don't ask for anything the user already told you, even if it wasn't phrased as a direct answer to
  the fields you'll eventually need -- read the whole description first, map what's already there
  onto Step 3's fields, and only ask about the gaps.
- Don't block on nice-to-have fields (e.g. "any screenshots?" for a bug that's already clearly
  described) -- ask for what's load-bearing for someone else to act on the issue, not everything that
  could conceivably help.
- Batch genuinely-needed questions into one round rather than a back-and-forth for each field, where
  possible.

## Step 3a -- Bug reports: apply Tatham's reasoning, not just his field list

The purpose of a bug report is to let someone else see the program fail -- either by reproducing it
themselves or by being given precise enough facts to reconstruct the failure without reproducing it
firsthand. Every fact below exists to serve that goal:

- **Steps to reproduce.** A numbered sequence, not a paragraph -- this is what actually lets someone
  else make it fail themselves, the single most valuable thing a report can contain. If the user's
  description already reads like reproduction steps, use them; if it's vaguer ("it crashes
  sometimes"), this is the thing to ask about first.
- **Expected vs. actual behavior**, kept as two distinct statements. This separates the objective
  fact of what happened from what the reporter thinks should have happened instead -- doing this
  explicitly often reveals whether something is a real bug or a misunderstanding of intended
  behavior.
- **Environment / version.** The single most commonly-omitted fact, and its absence is what most
  often turns a real, fixable bug into something nobody can reproduce. Ask for exactly what's needed
  (software version, OS, browser, relevant config) rather than a vague "any other details?"
- **Fact vs. speculation, kept structurally separate.** If the user offers a theory about the cause
  ("I think it's a race condition in the cache"), keep that in its own clearly-labeled part of the
  issue (e.g. a "Possible cause" line) rather than blending it into the description of what was
  observed -- so anyone reading the issue can tell which parts are verified fact and which are a
  guess, and a wrong guess doesn't undermine trust in the rest of the report.

## Step 3b -- Planned work: apply INVEST as an actual check, not a checklist to nod at

For a feature, task, or tech-debt item, walk the description against each INVEST criterion and
actually flag failures rather than treating this as a formality:

- **Independent.** Does this depend on other unstated work? If the description only makes sense
  after something else is built or decided, surface that explicitly as a blocking dependency (see
  Step 5) rather than silently assuming it or leaving it implicit -- an issue that looks
  actionable but secretly isn't is worse than one that's honest about being blocked.
- **Negotiable.** Is the description prescribing an exact implementation rather than describing the
  problem/goal? A title and body that lock in one specific technical approach can rob whoever picks
  this up of a chance to find a better one -- if the user's description reads like a spec, consider
  whether the "how" belongs in a comment/discussion rather than baked into the issue as the only
  acceptable solution.
- **Valuable.** Does the issue say *why* this matters, not just what it is? A description that's all
  "what" and no "why" leaves anyone triaging it unable to judge priority independent of the specific
  solution proposed.
- **Estimable.** Is there enough concrete information here for someone to size this? Extreme vagueness
  ("improve performance") isn't estimable -- if the description doesn't give enough to size, that's
  something to ask about or flag, not paper over with confident-sounding prose.
- **Small.** Could this reasonably be closed by one focused PR, or does it read like multiple
  sprints of work bundled together? This overlaps with the atomicity check above, but Small is also
  about scope creep within a single coherent piece of work -- if it's one thing but a *large* one,
  propose a breakdown into sub-issues (see Step 5) rather than filing one enormous issue nobody will
  ever fully close.
- **Testable.** Does the issue have clear closing criteria -- a concrete way to know when it's done?
  If the description doesn't make this obvious, this is worth asking about or drafting explicitly
  ("Closes when: ...") rather than leaving "done" undefined.

If a description fails Independent, Estimable, Small, or Testable outright, say so plainly before
drafting a polished-looking issue that papers over the gap -- a well-formatted issue with an
unaddressed blocking dependency or no closing criteria is a worse outcome than a shorter draft plus
an honest flag.

## Step 4 -- Hold the title to a concrete bar

Don't accept the first phrasing that comes to mind. A good issue title states **what** happened,
**where**, and **under what condition** -- scannable without opening the issue:

- Bad: "Login doesn't work"
- Good: "SSO login fails with 'Invalid credentials' error on Chrome 120 (macOS)"
- Bad (planned work): "Improve search"
- Good (planned work): "Add filter-by-date-range to the invoice search results page"

Before presenting a drafted title, check it against this bar explicitly: does it name the specific
thing (not just the general area), the location/context, and (for bugs) the condition under which it
happens? If not, redraft it rather than presenting the first version.

## Step 5 -- Suggest the platform mechanics, don't leave them for the user to notice

GitHub gives issues more structure than a title and body -- proactively suggest using it rather than
mentioning it only if asked. `references/github-commands.md` has the exact `gh` commands for all of
these (native sub-issue/dependency support landed in `gh` CLI 2.94.0 -- the reference file also has
the REST API fallback for older versions):

- **Sub-issues.** If this work clearly belongs under an existing larger issue/epic, suggest filing
  it as a sub-issue of that parent rather than a standalone issue.
- **Issue dependencies (blocked-by / blocking).** If Step 3b's Independent check (or anything else in
  the description) surfaced a real dependency on other work, state it explicitly as a blocking
  relationship, not just a passing mention in the body text -- this is the same fact stated as a
  structured relationship instead of prose, and it's what lets triage tools and other people actually
  see the dependency.
  - **Related issues.** If the user mentions or the search in Step 1 turned up genuinely related
  (but not duplicate) issues, suggest linking them (`#123`) rather than leaving the connection
  implicit.
- **Labels.** Suggest labels if the repo's labeling scheme is visible (existing labels on similar
  issues, a CONTRIBUTING.md that documents one, or `gh label list`) -- don't invent a plausible-
  sounding label name for a scheme you haven't actually seen; say what label *type* would fit (e.g.
  "a bug label, if one exists") if you can't confirm the exact name.

## Step 6 -- Map to the repo's existing issue templates if they exist

If the repo has `.github/ISSUE_TEMPLATE/*.yml` or `.md` templates, read them and fill the drafted
issue into whichever template fits (bug-report form vs. feature-request form) -- match the actual
field names/structure of that template rather than free-texting a generically-shaped issue that
doesn't line up with what the repo expects. If no templates are visible, fall back to the Tatham
(bug) or INVEST (planned work) structure above as the issue's shape.

## Step 7 -- Present the draft, then create only on confirmation

Show the drafted title, body, and suggested metadata (labels, dependencies, sub-issue/parent
relationship) together, and don't file it (via `gh issue create` or any repo-write tool) until the
user confirms -- treat this the same way a PR or commit would be treated: draft, show, confirm, then
act. If asked to just create it directly, that's fine, but the default is to show the draft first.
`references/github-commands.md` has the exact commands for creating the issue, filing it as a
sub-issue, setting dependencies, and (for the Step 1 duplicate case) commenting on an existing issue
instead of opening a new one.

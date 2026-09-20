---
name: codeowners
description: 'Generates a new CODEOWNERS file or audits an existing one, so pull requests automatically route to the right reviewers instead of relying on people remembering to tag someone. Covers GitHub''s CODEOWNERS mechanics precisely: file location precedence (.github/, repo root, docs/ -- first one found wins, the rest are ignored), gitignore-*like* pattern syntax with the sharp edges that actually bite (negation "!" and character-range "[]" syntax look valid but silently do not work, unlike real .gitignore), last-match-wins ordering (the LAST matching line in the file wins, so a broad "*" catch-all must come first and specific rules must come after it -- a catch-all placed after a specific rule silently overrides it, the opposite of what most people guess), and the easy-to-miss security default that the CODEOWNERS file itself needs an explicit owner or anyone with write access can quietly edit their own review requirements away. Also flags the sharper design fork most teams never learn exists: CODEOWNERS is a deliberately simplified descendant of Kubernetes'' OWNERS files (which trace back to Chromium), and gives up things OWNERS has -- a reviewer/approver trust-level split, emeritus-approver tracking, pattern-based auto-labeling -- so if a team actually wants two tiers of review trust rather than one flat owner role, this skill says so plainly rather than trying to fake it inside CODEOWNERS syntax. Use this skill whenever the user mentions CODEOWNERS, code owners, PR review routing/assignment, "who should review this", auto-requested reviewers, review ownership by directory/team, or asks to create, write, generate, fix, review, or audit a CODEOWNERS file -- even if they don''t use the exact word "CODEOWNERS."'
summary: Generates or audits a GitHub CODEOWNERS file -- correct location, ordering, and pattern syntax, a self-ownership check so the file can't be silently edited around, and a plain flag when a team actually needs the two-tier reviewer/approver trust model CODEOWNERS can't express.
---

# CODEOWNERS Skill

This skill either writes a new `CODEOWNERS` file or audits an existing one, so GitHub (or GitLab)
automatically requests the right reviewers on a pull request instead of relying on someone
remembering to tag the right person. It does not draft the PR itself (a separate, unrelated skill
covers that) and it is not a general permissions/access-control tool -- CODEOWNERS only affects who
gets *requested* as a reviewer (and, if branch protection requires it, who can *approve*); it does
not restrict who can push or merge on its own.

## The one thing to get right before anything else: this is a routing table, not an org chart

The single most common CODEOWNERS mistake is treating it as a map of "who is responsible for this
code" in some abstract organizational sense, and ending up with individual names scattered
everywhere. Treat it instead as a routing table for *review attention*: every line answers "when
this path changes, whose queue should a review request land in?" -- nothing more. This reframing
drives most of the concrete advice below:

- **Prefer teams over individuals** (`@org/backend-team`, not `@alice`) wherever the repo's platform
  supports team handles. An individual leaves, changes teams, or goes on leave, and a
  name-based rule silently keeps routing to someone who can no longer act on it (see the audit
  checklist's "stale owners" item) -- a team handle re-routes automatically as team membership
  changes.
- **Own directories, not individual files**, as the default granularity. File-level rules are
  brittle (a new file in a directory silently falls through to whatever broader rule matches next)
  and multiply the number of lines to keep in sync. Drop to file-level patterns only for a genuine
  exception within a directory (e.g. one sensitive config file inside an otherwise-unowned folder).

## Two modes

**Generate mode**: the user wants a new `CODEOWNERS` file (or wants to add coverage to one that
doesn't cover much yet). Interview, draft, validate, write.

**Audit mode**: the user has an existing `CODEOWNERS` file and wants it reviewed, or wants to know
why reviews aren't routing the way they expect. Read the file and the repo structure, then work
through the failure-mode checklist below in priority order.

## Step 1 -- The interview (generate mode)

Ask what's actually missing -- don't run through this as a rigid checklist if the user's request
already answers most of it:

1. **What are the major ownership boundaries?** Directories/paths and who owns each -- teams,
   individuals, or a mix. If the user only names individuals, ask once whether team handles exist
   for those individuals' groups, since that's the more durable choice (see above) -- but don't
   block on this if the repo genuinely has no teams set up.
2. **Trust model.** Is this an internal repo (all contributors are trusted employees/teammates) or
   does it take external/community contributions? This affects how aggressively to route review
   (an internal repo can tolerate looser catch-all ownership; a public repo benefits from tighter,
   more deliberate coverage so external PRs always get a real owner's eyes) -- reuse the answer if
   this session has already established it for a sibling skill on this repo (e.g. `pr-template`,
   `issue-template`).
3. **Does this team actually want two tiers of trust -- people who can weigh in vs. people who can
   actually approve/merge?** Ask this plainly rather than assuming flat ownership is always fine.
   If the answer is genuinely "yes, we want that split": say plainly that CODEOWNERS cannot express
   it -- it has exactly one flat "owner" role, with no native distinction between "can comment" and
   "can merge." The honest paths from there are (a) GitHub's own branch-protection rules layered on
   top of CODEOWNERS (e.g. requiring a review from a specific team *in addition to* CODEOWNERS
   approval), or (b) a bot-driven OWNERS-style system modeled on Kubernetes' `reviewers`/`approvers`
   split (see `references/owners-vs-codeowners.md` for what that actually looks like and why
   Kubernetes built it that way). Don't try to fake the split with clever CODEOWNERS syntax --
   there isn't a syntax trick that creates a role CODEOWNERS doesn't have. If the answer is "no,
   flat ownership is fine," say nothing further about this and move on -- most teams don't need it,
   and raising it as a lingering concern once answered would just be noise.
4. **File location.** GitHub checks `.github/CODEOWNERS`, then the repo root, then `docs/CODEOWNERS`
   -- the *first one found wins* and the others (even if present) are ignored entirely. If the repo
   already has a `CODEOWNERS` file somewhere, write to that same location rather than creating a
   second one elsewhere that GitHub will silently never read. If none exists yet, `.github/` is the
   conventional default (keeps the repo root uncluttered) unless the user has a reason to prefer
   another location.

## Step 2 -- Draft the rules, broadest-to-narrowest

GitHub (and GitLab) CODEOWNERS uses **last-match-wins**: when multiple patterns match a changed
file, only the *last* matching line in the file applies, not the most specific one and not all of
them combined. This is easy to get backwards, so be deliberate about which direction "last" points:
the catch-all (`*`) matches *every* file, so if it appears *after* a specific rule, it is the last
match for those files too -- and it wins, silently overriding the specific rule you meant to keep.
The specific rule has to come *after* the catch-all to actually take precedence.

- Order the generated file **broadest-to-narrowest**: any repo-wide catch-all (`* @org/some-team`)
  goes at the very *top* as the default, and specific directory/file rules come *after* it, in
  whatever order, since each one only needs to out-rank the catch-all above it, not each other
  (two specific rules for genuinely disjoint paths can't conflict with one another regardless of
  their relative order). If you're ever tempted to put the catch-all last "to make sure it always
  applies," don't -- that's exactly backwards, and it's the single most common way a generated
  CODEOWNERS file breaks in a way nothing warns you about.
- If the user's own ordering would create this trap (specific rules given before a catch-all that
  would then silently swallow them), reorder it and say why, rather than writing it in the order it
  was requested and letting the mistake ship.

## Step 3 -- Pattern syntax: gitignore-*like*, not gitignore

CODEOWNERS reuses `.gitignore`'s basic glob syntax (`*`, `**`, directory matching with a trailing
`/`) but is not a full reimplementation of it, and the gaps are exactly the syntax that looks most
plausible to someone who's used to `.gitignore`:

- **Negation (`!`) does not work.** `.gitignore` uses `!pattern` to un-ignore something a broader
  pattern matched; CODEOWNERS has no equivalent. A line starting with `!` is not an error -- it's
  simply not a negation, and won't behave the way whoever wrote it expects.
- **Character ranges (`[]`) do not work.** `.gitignore`-style bracket expressions
  (e.g. `file[0-9].txt`) aren't supported either.
- Never generate a pattern using either of these, and if auditing a file that has them, flag them
  explicitly (see the audit checklist) rather than assuming they do what they look like they do.

## Step 4 -- Own the CODEOWNERS file itself (the security default most hand-written files skip)

GitHub's own documentation calls this out, and it's easy to miss: if nobody is listed as an owner of
the `CODEOWNERS` file *itself*, then anyone with write access to the repo can edit their own review
requirements away -- weakening or removing the exact protection the file exists to provide, with no
review gate on that specific change. Default to including a line that makes the repo's top
maintainers/admin team an owner of the CODEOWNERS file's own path (e.g. `/.github/CODEOWNERS
@org/repo-admins`, adjusted for wherever the file actually lives), rather than leaving this as an
unstated gap. If you deliberately choose not to add this (the user has a specific reason not to), say
so explicitly rather than silently omitting it -- this is the kind of gap that looks fine right up
until someone quietly exploits it.

This line is itself a specific rule (it matches exactly one path), so Step 2's ordering rule applies
to it too: place it *after* the repo-wide catch-all, not before, or the catch-all would be the last
match for the CODEOWNERS file's own path and silently take over ownership of it instead.

## Step 5 -- Validate before writing

Before presenting the draft:
- Re-read it top to bottom as GitHub would evaluate it (last-match-wins) and confirm the effective
  owner of every major path is who you actually intended, not just what the line for that path says
  in isolation.
- Confirm no line uses `!` or `[]` syntax.
- Confirm the CODEOWNERS file's own path has an owner (Step 4), or that its absence was a deliberate,
  stated choice.
- Confirm every referenced team/individual handle is one the user actually confirmed exists --
  don't invent a plausible-sounding team name you haven't seen confirmed, the same way a fabricated
  label or reviewer name would be a bad idea elsewhere.

## Step 6 -- Write to disk

Write to whichever location Step 1's file-location question settled on: `.github/CODEOWNERS`, the
repo root (`CODEOWNERS`), or `docs/CODEOWNERS`. If more than one of these already exists in the repo,
say so -- only the first one GitHub checks (in that order) is actually being read, and the others are
dead weight that should probably be removed rather than left as a trap for the next person who edits
the wrong one.

## Audit mode -- failure-mode checklist, in priority order

When reviewing an existing `CODEOWNERS` file, work through these in order -- they're ordered by how
silently and severely each one breaks review routing, not alphabetically:

1. **Invalid lines that fail silently.** A typo'd username, a team handle that doesn't exist, or a
   malformed pattern doesn't error -- it just quietly stops routing reviews for that pattern, with
   no signal anywhere in the GitHub UI that it happened. Check every referenced handle against the
   repo's actual members/teams if that's checkable; flag anything that can't be confirmed rather than
   assuming it's fine.
2. **`!` or `[]` syntax present.** These parse as literal (broken) patterns, not as the negation or
   character-range behavior they look like -- treat any line using them as a bug to fix, not a style
   choice.
3. **Catch-all ordering problems.** A `*` (or other broad pattern) that appears *after* more
   specific rules for paths it also matches means those specific rules are dead -- the catch-all's
   owner is who actually gets requested for those paths, silently, because it's now the *last*
   matching line for them. Check every broad pattern's position relative to narrower ones that
   overlap it; the catch-all should be at or near the top, not the bottom.
4. **The CODEOWNERS file has no owner of its own.** If nothing in the file covers the CODEOWNERS
   file's own path, flag this as the security gap described in Step 4 -- anyone with write access
   can currently edit review requirements without a required review on that change.
5. **Stale owners.** Individuals (rather than teams) who no longer work on the repo, or no longer
   at the org at all -- these are also the audit's best evidence *for* switching to team-based
   ownership, since a team handle wouldn't have gone stale. Cross-reference against the repo's
   recent contributor/commit activity if that's available, and flag names that haven't touched the
   owned paths in a long time as worth revisiting, not necessarily wrong.
6. **File-level micromanagement.** Long runs of individual-file rules where a single directory rule
   would do -- not broken, but a maintenance burden and a sign the file wasn't designed around the
   directory-first default from the top of this skill.

Present findings in this priority order, not in file order -- a silently-broken line five lines down
matters more than a cosmetic ordering nit at the top.

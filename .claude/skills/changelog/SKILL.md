---
name: changelog
description: >-
  Generates a new CHANGELOG.md or adds/updates entries in an existing one, following the Keep a
  Changelog 2.0.0 standard (six fixed categories -- Added, Changed, Deprecated, Removed, Fixed,
  Security -- ISO 8601 dates, an Unreleased section, and reference-style version links). Before
  drafting, establishes whether the repo is a single package or a monorepo needing per-component
  changelogs, whether commit history already follows Conventional Commits (so entries can be
  derived from git log/diff instead of asked for from scratch), and whether release automation
  (semantic-release, release-please, or similar) already drafts entries -- in which case the
  skill's job shifts to a human-readability pass on the automation's output rather than writing
  from a blank file. Also applies Keep a Changelog 2.0.0's own explicit guidance for an AI drafting
  a changelog: summarize what's notable to a reader, never paste raw commit messages or git log
  output as entries. Use this skill whenever the user mentions a CHANGELOG, release notes, "what
  changed in this version," cutting a release, or asks to create, write, update, or clean up a
  CHANGELOG.md file -- even if they call it something else, like a "changes" file or "history"
  file. This is one of a family of doc-generation skills (README, CONTRIBUTING, SECURITY,
  CODE_OF_CONDUCT, etc.) and is scoped specifically to the changelog file itself, not to setting up
  release automation or commit-message linting from scratch.
summary: Generates or updates a CHANGELOG.md following Keep a Changelog 2.0.0 -- asks the framing questions first (single package vs. monorepo, Conventional Commits or not, release automation already running or not), drafts entries from commit history when it can, and knows when to just polish what a release-automation tool already wrote instead of writing from scratch.
---

# CHANGELOG Skill

This skill writes or updates a `CHANGELOG.md` following [Keep a Changelog
2.0.0](https://keepachangelog.com/en/2.0.0/) -- the first major revision to the standard in nine
years (June 2026). The file format itself didn't change from 1.1.0, but the guidance around it
expanded in ways that matter for exactly this task: how to mark breaking changes, how to handle
versioning schemes other than strict SemVer, how to structure a changelog across a monorepo, and
--most relevant of all -- explicit guidance for an AI drafting changelog entries. Treat that
guidance as current convention, not something to second-guess against older habits.

This skill is scoped to the changelog file itself. It does not set up commit-message linting or
release automation from scratch (a separate concern), though it needs to reason about whether
those already exist, since that changes what the skill's job actually is here.

## Step 1 -- Three questions before drafting anything

Don't skip straight to writing entries. Answer these first -- from what the user already told you,
from the repo itself, or by asking directly if neither settles it:

### 1a. Single package, or a monorepo with independently-versioned packages?

Keep a Changelog's format assumes **one version number per changelog**. That assumption holds for
most repos, but breaks down the moment a repo contains several packages that get versioned and
released independently (a typical JS/TS monorepo with per-package `package.json` versions, or
several Python packages sharing one repo). Check for this before defaulting to a single flat file
-- look for a workspace config (`pnpm-workspace.yaml`, `lerna.json`, `nx.json`, multiple
`package.json`/`pyproject.toml` files with their own version fields) or just ask.

If it's a monorepo with independent versioning, Keep a Changelog 2.0.0 now addresses this directly:
keep a `CHANGELOG.md` per component (the detail lives there), and optionally a central,
repo-root changelog that summarizes across components for anyone who doesn't care which package
changed, just that something did. Don't force a single flat file onto this shape -- propose the
split rather than degrading the format to fit. A single package with one version number is the
common case and needs none of this; only raise it when the repo's structure actually calls for it.

### 1b. Does the repo already use Conventional Commits?

Look at recent commit history (`git log --oneline -30` or similar). If commits are structured as
`type(scope): description` (`feat:`, `fix:`, `docs:`, `BREAKING CHANGE:` in footers, `!` before the
colon for breaking changes), the skill can **derive draft entries directly from the commits or the
diff itself**, rather than asking the user to describe what changed from memory. This is a real
time-saver and worth checking for even if the user didn't mention it. If there's no such
convention, fall back to asking conversationally: what changed, does it affect existing behavior,
does it affect a public/documented interface.

Conventional Commits isn't a competing changelog format -- it's the commit-message convention that
makes changelog automation possible in the first place. Its types map directly onto Semantic
Versioning's bump semantics (`fix:` -> PATCH, `feat:` -> MINOR, any `BREAKING CHANGE` -> MAJOR
regardless of type), which is exactly what tools like semantic-release and release-please parse to
generate both the version bump and the changelog automatically. Recognizing Conventional Commits in
a repo's history is a strong signal that the next question's answer might be yes.

### 1c. Is anything already automating this?

Check for `semantic-release`, `release-please`, or similar in `package.json` scripts/devDependencies,
CI workflow files, or a `.release-please-manifest.json` / `.releaserc*` config. If one of these is
already running, **the skill's job changes**: it's no longer "write the changelog" but "review and
improve what the automation already drafted." Auto-generated entries built straight from raw commit
messages are frequently too technical, too terse, or phrased for other developers rather than the
people who'll actually read the changelog -- turning `fix(auth): correct off-by-one in token expiry
check` into something a user can actually parse is squarely this skill's job, even when the
automation already picked the version number and category. Don't redo the automation's job
(re-deciding version bumps, re-triggering releases) -- just make the prose readable and correctly
categorized. See Step 6 for what "readable" means here.

## Step 2 -- Core format (unchanged since 1.1.0)

- File is named `CHANGELOG.md`, newest release at the top.
- Exactly six categories, and only these six -- don't invent new ones even when a change doesn't
  obviously fit (see Step 4 for the trickiest boundary): `Added`, `Changed`, `Deprecated`,
  `Removed`, `Fixed`, `Security`.
- Dates in ISO 8601 (`YYYY-MM-DD`), largest unit to smallest.
- An `## [Unreleased]` section stays at the very top, above the newest dated release, collecting
  changes as they land so there's always somewhere for the next entry to go before it's cut into a
  numbered release.
- **Omit empty categories entirely** for a given release -- don't list `### Security` with nothing
  under it "just in case." Keep a Changelog is explicit that a missing category should read as
  "nothing notable happened here," not as something forgotten. If a category has no entries, it
  simply doesn't appear under that version.
- Version headings double as reference-style Markdown links to a diff/compare URL, resolved at the
  bottom of the file, where the repo's hosting supports it (GitHub/GitLab compare links, most
  commonly):

  ```markdown
  ## [Unreleased]

  ### Fixed
  - Corrected an off-by-one error in token expiry checks that logged users out one minute early.

  ## [2.0.0] - 2026-06-07

  ### Added
  - Support for calendar-based versioning as an alternative to SemVer.

  ### Changed
  - **Breaking:** the `--strict` flag is now the default; pass `--no-strict` to restore the old
    behavior.

  [Unreleased]: https://github.com/org/repo/compare/v2.0.0...HEAD
  [2.0.0]: https://github.com/org/repo/compare/v1.1.0...v2.0.0
  ```

  If the repo isn't hosted somewhere with compare URLs (or the user doesn't want them), plain
  version headings without links are fine -- the links are a nice-to-have Keep a Changelog
  recommends, not a hard requirement of the format.

## Step 3 -- Marking breaking changes

Keep a Changelog 2.0.0 doesn't add a seventh category for this -- a breaking change still belongs
in whichever of the six categories it actually is (usually `Changed` or `Removed`). Mark it inline
with a **`**Breaking:**`** prefix at the start of the entry, inside its normal category, rather than
carving out a separate section:

```markdown
### Changed
- **Breaking:** the `--strict` flag is now the default; pass `--no-strict` to restore the old
  behavior.
```

Say specifically *what* breaks -- which interface the reader can no longer assume is stable (a CLI
flag, a library's public API, a wire protocol, a file format, a config schema). "Breaking change"
on its own tells a reader nothing they can act on; naming the interface does. Keep the note itself
short, and link out to a migration guide for anything that needs more than a sentence or two to
explain.

## Step 4 -- The Changed / Fixed / Security boundary

This is the boundary people actually get wrong in practice, so it's worth a clear rule rather than
leaving it to feel:

- **Fixed**: the old behavior was a bug -- it didn't do what it was supposed to. Now it does.
- **Changed**: the old behavior was working as intended. It's now intentionally different.
- **Security**: the change closes a vulnerability. It very often *also* fits `Fixed` (a security bug
  is still a bug) or occasionally `Changed`, but gets called out under `Security` specifically
  because security-conscious readers scan for that heading first, and a fix with real exploit
  implications deserves that visibility regardless of which other category it would otherwise sit
  in.

When genuinely unsure whether something is `Changed` or `Fixed`: ask whether the old behavior was a
bug. If yes, it's `Fixed`, even if the change is large. If the old behavior was intentional and is
now different on purpose, it's `Changed`, even if the change is small. For a security fix, lead the
entry with the vulnerability identifier when one exists (`- CVE-2026-12345: ...`), since that's
often the first thing a reader scanning for security-relevant changes is looking for.

## Step 5 -- Versioning schemes beyond SemVer

Keep a Changelog 2.0.0 explicitly doesn't require Semantic Versioning. Calendar versioning, a plain
incrementing number, or a date-as-version scheme are all fine -- just say which one the project uses
(a short line near the top of the file, next to where SemVer would normally be credited, is enough).
A continuously-deployed project with no version numbers at all can skip numbered releases entirely
and just keep dated entries accumulating under `Unreleased`, or roll them into dated pseudo-releases
(`## [2026-09-20]`) instead of version numbers. Don't assume SemVer is mandatory and push a version
scheme onto a project that isn't using one -- check what the repo actually does (existing git tags,
`package.json`/`pyproject.toml` version field, or just ask) before assuming.

## Step 6 -- Drafting entries

**From Conventional Commits history** (when Step 1b found this convention in use): read the commits
since the last release (`git log <last-tag>..HEAD --oneline`, or the relevant diff) and group them
by type -- `feat:` commits become candidate `Added` or `Changed` entries, `fix:` commits become
candidate `Fixed` entries, anything with `BREAKING CHANGE` or a `!` becomes a `**Breaking:**`-marked
entry in whichever category it actually changes. Don't stop at translation, though -- see the
rewriting guidance below, since a raw commit subject line is rarely a good changelog entry as-is.

**Conversationally** (when there's no such convention): ask what changed, and specifically whether
each change affects behavior someone would notice, whether it affects a documented/public interface
(bumping it out of "internal implementation detail" territory), and whether anything about it is a
security concern. Draft entries from the answers rather than trying to reverse-engineer intent from
a diff alone.

**Reviewing automation output** (when Step 1c found semantic-release/release-please or similar
already running): read what the automation drafted and rewrite for the actual reader, not the other
developers who wrote the commits. This is the core of what Keep a Changelog 2.0.0 says explicitly
about AI-drafted changelogs, and it applies whether the draft came from a bot or from this skill
itself: *machines can draft, but humans curate* -- a model (the automation, or this skill) can
propose groupings and wording, but deciding what's actually notable to the reader, and saying it
plainly for them, is not something to skip. Concretely, that means:

- Summarize the user-facing effect of a change, not the implementation. `fix(auth): correct
  off-by-one in token expiry check` becomes "Fixed a bug where users could be logged out one minute
  earlier than their session should have expired" -- not a restatement of the commit subject.
- Never paste a raw commit message, git log output, or PR title directly into the changelog as an
  entry. If nothing better exists, that's a sign the underlying commit message itself needs work
  (a separate, upstream problem this skill doesn't solve), not a reason to lower the bar here.
- Sort into the correct one of the six categories -- automation frequently gets this only roughly
  right (e.g., dumping everything non-`fix` into `Changed`), so check each entry rather than trusting
  the bucket it arrived in.
- Drop anything that isn't actually notable to a reader of this changelog (a `chore:` dependency
  bump, an internal refactor with no observable effect) rather than including it because a commit
  happened to reference it. Not every commit deserves an entry; not every entry needs a matching
  commit.
- Keep the reasoning in prose the reader can follow, not commit-speak or ticket references without
  context.

If this project is going to keep doing AI-assisted changelog drafting on an ongoing basis (not just
this one pass), it's worth telling the user they can store a short brief on what "notable" means for
their specific readers in a project file like `AGENTS.md` or `CLAUDE.md` -- Keep a Changelog 2.0.0
recommends exactly this, since "notable to a reader" varies by project and is worth writing down
once rather than re-deriving it every time.

## Step 7 -- Validate before writing

- Every entry is under exactly one of the six categories, and no category name has been invented or
  altered.
- No category appears with zero entries under it.
- Dates are ISO 8601.
- `[Unreleased]` exists at the top, even if currently empty (a fresh, unreleased-only file is fine
  for a brand-new project with nothing shipped yet).
- Breaking changes are marked inline with `**Breaking:**` and name the specific interface affected,
  not left as an unmarked entry or (worse) as a subjective "this is a big one."
- No raw commit message, git log line, or PR title was pasted in verbatim as an entry.
- If this is a monorepo (Step 1a), confirm you're writing to the right per-component file, and that
  a central/root changelog (if one exists) is being kept in sync rather than drifting from the
  per-component ones.

## Step 8 -- Write to disk

Write (or update) `CHANGELOG.md` at the repository root, or at the relevant package root for a
monorepo component (per Step 1a's decision). If updating an existing file, preserve its existing
released history untouched -- only the `[Unreleased]` section and, when cutting a release, the
newly-dated version section at the top should change. Don't reformat or "clean up" old, already-
released entries as a side effect of an unrelated update; if the user specifically wants historical
entries reformatted to match 2.0.0 guidance, treat that as its own explicit task, not something to
do quietly while adding new ones.

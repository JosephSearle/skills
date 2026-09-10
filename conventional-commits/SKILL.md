---
name: conventional-commits
description: Drafts Conventional Commits-style commit messages (type(scope) prefix, description, wrapped body, footers) and actually stages and commits the changes locally with git on the developer's behalf, once they approve the message. Use this whenever someone asks to commit changes, write or draft a commit message, "stage and commit this", "write a conventional commit for this diff", mentions commit types like feat/fix/chore, or wants their working tree turned into one or more clean, well-scoped local commits -- even if they just say "commit this for me" without naming a format. Also use it when a diff mixes several unrelated changes and the developer wants them split into separate atomic commits. This skill only creates local commits (git add / git commit); it does not push, open pull requests, or touch GitHub -- that's a separate concern (see the cl-creation skill for PR titles/descriptions).
---

# Conventional Commits

Turns a working tree's changes into one or more commits that follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) spec, formatted per the classic 50/72 rule, and actually commits them locally with git -- once the developer has approved the drafted message. The job has two equally real halves: writing a good message, and safely running the git commands that make it a real commit. Don't stop at drafting text if the developer wants it committed.

## Why this shape matters

Conventional Commits give every commit machine-parseable structure (type, optional scope, breaking-change marker) that changelog generators, semantic-versioning tools, and humans scanning `git log` can all rely on. A `fix:` predictably means a patch release; a `feat:` predictably means a minor bump; `BREAKING CHANGE` predictably means major. Getting this right isn't pedantry -- it's what makes those downstream tools trustworthy.

The 50/72 rule exists for a more mundane reason, but one that still holds up: a ~50-character subject line stays legible in `git shortlog` and terminal title bars, and body lines wrapped at 72 characters survive `git log`'s 4-space indent on an 80-column terminal without wrapping awkwardly.

Combining both means the subject line has two jobs at once -- being a valid Conventional Commits header *and* fitting in roughly 50 characters. The `type(scope)!: ` prefix eats into that budget, so the description itself often needs to be tighter than a plain 50-character rule of thumb would suggest on its own.

## Workflow

### 1. Look at what's actually changed

Never draft a message from assumption. Run `git status`, then `git diff` and `git diff --staged` to see real content, not just filenames -- the right Conventional Commits `type` depends on what a change *does*, not which file it happens to live in. Full command reference (including how to check for an existing house style) is in `references/git-commands.md`.

### 2. Decide whether this is one commit or several

Default to staging everything and writing one commit -- that's usually what "commit this" means, and splitting isn't warranted just because a diff is large. But before drafting, check whether the diff actually tells one story or several unrelated ones stapled together. Split it when:

- The diff touches clearly separate concerns that would each deserve a different `type` or `scope`.
- One part fixes something and another part adds something unrelated -- `fix` and `feat` should almost never share a commit.
- You can't describe the whole diff in one honest sentence without an "and" doing a lot of work.

When it should be split, group the changed hunks/files by concern and stage + commit each group separately -- `git add <specific paths>`, or `git add -p` when a single file mixes two concerns in its own hunks (see `references/git-commands.md`). Each resulting commit should be small enough to describe truthfully with one Conventional Commits header. A genuinely single-purpose change stays one commit no matter how many lines it touches -- this is about how many stories are being told, not line count.

### 3. Draft the message(s)

For each commit:

```
<type>[(scope)][!]: <description>

[body]

[footer(s)]
```

- **type** -- `feat` (new capability) and `fix` (bug patch) are the two the spec defines explicitly. Also fine to reach for when they fit better: `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`. Pick whichever actually matches what the diff does.
- **scope** (optional) -- a noun for the affected area, in parentheses: `fix(parser):`, `feat(auth):`. Leave it off if the change doesn't cleanly belong to one area.
- **!** -- goes immediately before the colon (`feat(api)!:`) for a backwards-incompatible change. Pair it with a `BREAKING CHANGE:` footer that says what breaks and how to adapt -- the marker and the footer explain the same thing at two levels of detail, so include both once either is true.
- **description** -- short, imperative, right after `: ` ("add", not "added" or "adds"). Aim for the whole header line (type + scope + description) to land around 50 characters where you reasonably can, remembering the prefix counts against that budget.
- **body** (optional; one blank line after the header) -- the "why" a future reader won't get from the diff, not a restatement of it. Wrap each line at 72 characters. Skip the body only when the header genuinely says it all; most real changes deserve at least a sentence of context.
- **footer(s)** (optional; one blank line after the body) -- `BREAKING CHANGE: <what breaks, how to migrate>`, issue references (`Fixes #123`, `Refs #456`), or other `Token: value` / `Token #value` metadata. `BREAKING CHANGE` is the one token that's case-sensitive in the spec -- write it exactly that way.

Leave the footer at that. Don't add a `Co-Authored-By:` trailer or any other AI-attribution line to commits made through this skill, even if a session's own default instructions would otherwise add one to a commit -- these are the developer's local commits, authored under their own name, and this skill's job stops at drafting a correct Conventional Commits message, not appending credit for having drafted it.

Before showing a draft to the developer, run it through `scripts/validate_commit_message.py` (see that script's `--help`) -- it checks the 50/72 wrapping and the structural parts of the header/footer, so formatting slips get caught before the developer sees them rather than after.

### 4. Show the developer the draft and get their go-ahead

Present each drafted message -- and, if splitting, which files/hunks go with which message -- before running anything. This is the one non-negotiable gate: staging and committing change the developer's actual repo history, and a Conventional Commits header makes a claim (this is a `fix`, this is `BREAKING`) that only the developer can really vouch for. Let them edit type, scope, or wording before anything is run. A commit is cheap to redo; a wrong SemVer signal that ships downstream isn't.

### 5. Stage and commit

Once approved, actually do it -- the point of this skill is to save the round trip to a manual `git add`/`git commit`, not just to hand over text to paste in. For each approved commit, in order:

1. Stage the specific paths or hunks for that commit.
2. Commit with `git commit -F <tempfile>`, having written the exact approved message to a temp file first -- never `git commit -m "<multi-line text>"`, which mangles quoting and blank lines. Full commands in `references/git-commands.md`.
3. Confirm it landed with `git log -1 --stat` before moving to the next commit in a split, so a rejected commit (e.g. a pre-commit hook) doesn't get silently skipped over.

Never push, force-push, amend an existing commit, or open a pull request as part of this skill -- those are separate actions with their own stakes, and "commit this" doesn't imply "and then push it" or "and then open a PR."

## Notes on approach

- Splitting into atomic commits is a judgment call about the diff's content, not a mechanical target -- don't manufacture a three-way split because "atomic" sounds like it wants many; one genuinely single-purpose diff is one commit regardless of size.
- If `git status` shows nothing to commit, say so rather than inventing one.
- If the repo already has a commit message convention that conflicts with Conventional Commits (check `.gitmessage`, `CONTRIBUTING.md`, or recent `git log` history), flag the conflict to the developer instead of silently overriding it with this skill's default.

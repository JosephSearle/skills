# Git commands for conventional-commits

Two groups: read-only inspection (safe to run anytime) and local mutation (staging and committing -- only run these after the developer has approved the drafted message, per SKILL.md step 4). Nothing in this file pushes, force-pushes, amends, or touches GitHub.

## Inspecting the working tree (read-only)

### See the overall shape
```
git status
```
Shows staged, unstaged, and untracked files. Run this first, every time -- never assume what's changed from context alone.

### See actual content
```
git diff              # unstaged changes
git diff --staged     # already-staged changes
git diff HEAD          # everything different from the last commit, staged or not
```
Read the diff itself, not just `git status`'s file list -- the right Conventional Commits `type` depends on what a change does, not which file it lives in.

### Check for an existing house style before imposing your own
```
git log --oneline -20
cat .gitmessage 2>/dev/null
cat CONTRIBUTING.md 2>/dev/null | grep -i -A5 commit
```
If the team already has a convention (even a non-Conventional-Commits one), flag the conflict to the developer rather than silently overriding it.

## Staging (mutating -- only once a message is drafted and about to be approved)

### Stage everything
```
git add -A
```
The default when the whole working tree is one coherent change.

### Stage specific paths, for a split into multiple commits
```
git add path/to/file1 path/to/file2
```

### Stage only part of a file, when one file mixes two concerns
```
git add -p path/to/file
```
Walks through the file hunk by hunk (`y` to stage, `n` to skip, `s` to split further, `q` to quit) so unrelated hunks inside the same file can land in different commits without hand-editing the diff.

### Unstage if you staged the wrong thing before committing
```
git restore --staged path/to/file
```

## Committing (mutating -- only after developer approval, per SKILL.md step 4)

### Always write the message to a file first
Multi-line Conventional Commits messages (header, blank line, body, blank line, footer) are fragile to pass inline -- shell quoting mangles blank lines and special characters like `!` or backticks. Write the exact approved message to a temp file, then:
```
git commit -F /path/to/commit-message.txt
```
Use the session's own scratch/temp space for that file, not a path inside the repo -- it should never end up tracked or left behind after the commit.

### Verify it landed
```
git log -1 --stat
```
Shows the commit that was just made and which files it touched. Confirm this matches what was approved before moving on to the next commit in a split -- a rejected or partial commit should never be assumed to have succeeded.

### If a pre-commit hook rejects the commit
Don't retry with `--no-verify` to force it through -- skipping hooks is the developer's call, not a default workaround. Report exactly what the hook said and let them decide how to proceed.

## What this skill never runs

```
git push                        # pushing is a separate, explicitly-gated action
git commit --amend              # rewrites history; not implied by "commit this"
git commit -m "<multi-line>"    # unsafe quoting -- always use -F with a file instead
gh pr create / gh pr edit       # PR creation is out of scope here -- see the cl-creation skill
git reset --hard                # destructive; never run as part of drafting or fixing a commit
```

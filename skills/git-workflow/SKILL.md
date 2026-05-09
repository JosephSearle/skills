---
name: git-workflow
description: >
  Manage a GitHub repository end-to-end: branching strategy, committing (Conventional Commits v1.0.0),
  pull requests, code review, merging, releases, and branch cleanup. Use this skill whenever the agent
  needs to create a branch, commit changes, open or merge a pull request, tag a release, or perform
  any GitHub repository operation. Triggers on: "create a branch", "commit my changes", "open a PR",
  "merge this PR", "tag a release", "review this PR", "clean up branches", or any instruction
  involving git or GitHub repository state.
---

# Git Workflow Skill

A skill for managing GitHub repositories end-to-end from an agent harness with sandbox capabilities.
Covers branching, committing, pull requests, code review, merging, releases, and cleanup — grounded
in GitHub Flow, Conventional Commits v1.0.0, and the GitHub MCP server tool set.

---

## Core Philosophy

Every repository operation must answer three questions before executing:

1. **What is the current state?** — verify working tree, branch, and remote status before acting
2. **What is the right tool?** — prefer MCP server for GitHub API operations, `git` CLI for local operations
3. **Is this safe to do?** — check safety guards before any destructive or shared-state operation

Never assume state. Always read before writing.

---

## Step 1 — Tooling Resolution

Determine which tools are available in the current harness and apply this priority order for every operation:

```
Is the GitHub MCP server available in this harness?
  └─ YES → Use MCP tools for all GitHub API operations (PRs, branches via API, merging, releases)
  └─ NO  → Use `gh` CLI for GitHub API operations

Is `gh` CLI authenticated? (run: gh auth status)
  └─ YES → Use `gh` as fallback for GitHub operations
  └─ NO  → Authenticate first: gh auth login

Always use `git` CLI for local operations regardless of above:
  - Staging files
  - Committing
  - Rebasing
  - Conflict resolution
  - Fetching / pulling
```

**Tool-to-operation mapping:**

| Operation | Preferred | Fallback |
|-----------|-----------|---------|
| Create branch (remote) | `git push -u origin <branch>` after local create | MCP: `create_branch` |
| List branches | MCP: `list_branches` | `git branch -a` |
| Stage & commit | `git add` + `git commit` | — |
| Push commits | `git push` | — |
| Create PR | MCP: `create_pull_request` | `gh pr create` |
| List / search PRs | MCP: `search_pull_requests` / `list_pull_requests` | `gh pr list` |
| Merge PR | MCP: `merge_pull_request` | `gh pr merge` |
| Push files directly | MCP: `push_files` | `git add` + `git commit` + `git push` |
| List commits | MCP: `list_commits` | `git log` |
| Create release | `gh release create` | — |
| List issues | MCP: `list_issues` | `gh issue list` |

---

## Step 2 — Safety Guards

Run these checks before any operation. Never skip.

**Before branching or committing:**
```bash
git status                  # confirm working tree state
git fetch origin            # sync remote state
git log origin/main..HEAD   # check if local is ahead
```

**Hard rules — NEVER do these without explicit user instruction:**
- `git push --force` or `git push --force-with-lease` to a shared branch
- `git reset --hard` with uncommitted changes present
- Commit directly to `main`, `master`, or `develop`
- Include `.env`, credentials, API keys, or secrets in any commit
- Delete a remote branch that has an open PR

---

## Step 3 — Branching Strategy

### Choose the right model

```
Is this a product with scheduled, versioned releases (e.g. mobile app, SaaS with release trains)?
  └─ YES → Git Flow
  └─ NO  ↓

Is this a team deploying continuously to production multiple times per day?
  └─ YES → Trunk-Based Development
  └─ NO  → GitHub Flow (default for most teams)
```

**GitHub Flow** (default): `main` is always deployable. All work happens on short-lived feature branches that merge into `main` via PR.

**Git Flow**: Long-lived `develop` branch. Features branch from `develop`. Releases branch from `develop` into `release/<version>`, then merge to both `main` and `develop`. Hotfixes branch from `main`.

**Trunk-Based**: All branches are extremely short-lived (hours, not days). Feature flags gate incomplete work. PRs are small and frequent.

### Branch naming conventions

Format: `<type>/<ticket-id>-<short-description>` (ticket ID optional if no issue tracker)

| Prefix | When to use | Example |
|--------|------------|---------|
| `feature/` | New functionality | `feature/AUTH-42-oauth2-login` |
| `fix/` | Bug fix | `fix/API-17-null-pointer-on-empty-list` |
| `hotfix/` | Urgent production fix | `hotfix/PROD-9-payment-timeout` |
| `release/` | Release preparation | `release/2.4.0` |
| `chore/` | Maintenance, deps, config | `chore/bump-node-20` |
| `docs/` | Documentation only | `docs/update-api-reference` |
| `ci/` | CI/CD pipeline changes | `ci/add-integration-test-stage` |

**Rules:**
- Always lowercase kebab-case
- Max 50 characters after the prefix slash
- No spaces, no uppercase, no special characters except `-` and `/`

### Create a branch

```bash
git checkout main
git pull origin main
git checkout -b feature/<ticket-id>-<short-description>
git push -u origin feature/<ticket-id>-<short-description>
```

---

## Step 4 — Committing (Conventional Commits v1.0.0)

All commits MUST follow the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

### Commit message format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | SemVer impact | When to use |
|------|--------------|------------|
| `feat` | MINOR | New feature |
| `fix` | PATCH | Bug fix |
| `docs` | none | Documentation only |
| `style` | none | Formatting, whitespace — no logic change |
| `refactor` | none | Code restructure — no feature or fix |
| `perf` | none | Performance improvement |
| `test` | none | Adding or updating tests |
| `build` | none | Build system or dependency changes |
| `ci` | none | CI/CD configuration |
| `chore` | none | Maintenance tasks that don't fit above |

### Breaking changes

Two valid notations — use either:

```
feat!: drop support for Node 18
```

```
feat(api): change response envelope structure

BREAKING CHANGE: the `data` key is now `result` in all API responses
```

### Rules

- **Description:** imperative mood, lowercase, no period at end — "add login" not "Added login."
- **Scope:** optional, lowercase noun describing the section affected — `feat(auth):`, `fix(api):`
- **Body:** explain WHY, not WHAT. Wrap at 72 characters per line.
- **Atomic commits:** one logical change per commit. Do not bundle unrelated changes.
- **Never commit:** `.env` files, credentials, API keys, secrets, compiled artifacts, `node_modules`

### Commit workflow

```bash
git status                          # review what changed
git diff                            # inspect unstaged changes
git add <specific-files>            # stage only related files — avoid `git add .`
git diff --staged                   # verify what will be committed
git commit -m "feat(auth): add OAuth2 login flow"
```

For commits with a body:
```bash
git commit -m "$(cat <<'EOF'
feat(auth): add OAuth2 login flow

Adds Google and GitHub OAuth2 providers. Session tokens are stored
in httpOnly cookies to meet compliance requirements.

Closes #42
EOF
)"
```

> Full type reference and examples: `references/conventional-commits.md`

---

## Step 5 — Pull Requests

### Principles

- **Fix one problem** — a PR MUST address a single concern. If work spans multiple problems, split into separate PRs
- **Limit scope** — most PRs should represent less than 8 hours of work. Larger changes should be broken into a logical sequence of smaller PRs
- **Communicate before coding** — if working from an existing issue, claim it before starting. For new ideas, create an issue first so the approach can be discussed before a PR is opened
- **Concise and complete** — the PR body must give a reviewer everything they need without requiring them to read the code to understand the intent

### When to create a PR

- Any change targeting `main`, `master`, or `develop` MUST go through a PR — never push directly
- Open as **Draft** when work is in progress or early feedback is needed
- Convert to **Ready for Review** only when the readiness checklist below is complete

### Readiness checklist

Before marking a PR ready for review:

- [ ] Addresses exactly one problem or concern
- [ ] All commits follow Conventional Commits format
- [ ] Linting and automated checks pass locally
- [ ] Changes are tested (automated tests for logic, manual verification for UI/integration)
- [ ] PR title follows Conventional Commits format
- [ ] PR body is complete — all sections filled, not left as placeholders

### PR title

MUST follow Conventional Commits format — treat it as the squash merge commit message:

```
<type>[optional scope]: <short description>
```

Examples:
- `feat(auth): add OAuth2 login flow`
- `fix(api): handle null response on empty query`
- `chore: bump dependencies to latest`

### PR body structure

```markdown
## Summary
- <What changed and why — 1-3 bullets>

## Changes
- <Specific change 1>
- <Specific change 2>

## Test Plan
- [ ] <How to verify this works>
- [ ] <Edge case tested>

## Reviewer Focus
- <Specific area or decision you want the reviewer to pay attention to>
- <Any tradeoffs made or alternatives considered>

## Related Issues
Closes #<issue-number>
```

### Create a PR

**MCP (preferred):**
```json
{
  "name": "create_pull_request",
  "arguments": {
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "feat(auth): add OAuth2 login flow",
    "body": "## Summary\n...",
    "head": "feature/AUTH-42-oauth2-login",
    "base": "main",
    "draft": false,
    "maintainer_can_modify": true
  }
}
```

**Fallback (`gh` CLI):**
```bash
gh pr create \
  --title "feat(auth): add OAuth2 login flow" \
  --body "$(cat <<'EOF'
## Summary
- Adds OAuth2 login via Google and GitHub providers

## Changes
- Added GoogleOAuthProvider and GitHubOAuthProvider classes
- Session tokens stored in httpOnly cookies

## Test Plan
- [ ] Login with Google account works end-to-end
- [ ] Login with GitHub account works end-to-end

## Reviewer Focus
- Cookie expiry logic in auth/session.ts — confirm this meets compliance requirements
- Error handling for revoked tokens

## Related Issues
Closes #42
EOF
)" \
  --base main \
  --head feature/AUTH-42-oauth2-login
```

---

## Step 6 — Merging

### Choose the merge method

```
Does the branch have a clean, meaningful commit history that tells a story?
  └─ YES → Merge commit (preserves history)
  └─ NO  ↓

Is the branch a single logical change with messy/WIP commits?
  └─ YES → Squash merge (collapses to one Conventional Commit)
  └─ NO  ↓

Is the team maintaining a strict linear history?
  └─ YES → Rebase merge
```

**Default recommendation:** squash merge for feature branches, merge commit for release branches.

### Pre-merge checklist

- [ ] All required status checks pass
- [ ] Required approvals obtained
- [ ] No unresolved review comments
- [ ] Branch is up to date with base (rebase or merge base if behind)

### Update branch if behind base

```bash
git checkout feature/AUTH-42-oauth2-login
git fetch origin
git rebase origin/main        # preferred: keeps linear history
# OR
git merge origin/main         # if rebase is not appropriate
git push --force-with-lease   # only after rebase, never on shared branches
```

### Merge the PR

**MCP (preferred):**
```json
{
  "name": "merge_pull_request",
  "arguments": {
    "owner": "<owner>",
    "repo": "<repo>",
    "pullNumber": 124,
    "commit_title": "feat(auth): add OAuth2 login flow (#124)",
    "merge_method": "squash"
  }
}
```

**Fallback (`gh` CLI):**
```bash
gh pr merge 124 --squash --subject "feat(auth): add OAuth2 login flow (#124)" --delete-branch
```

---

## Step 7 — Releases & Tagging

### Determine the next version (Semantic Versioning)

Inspect commits since the last release tag:

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

Apply these rules:
- Any `BREAKING CHANGE` or `!` commit → bump **MAJOR**
- Any `feat:` commit (no breaking change) → bump **MINOR**
- Only `fix:`, `perf:`, `docs:`, `chore:` etc → bump **PATCH**

### Tag and release

```bash
git tag -a v<MAJOR>.<MINOR>.<PATCH> -m "<type>: <description of release>"
git push origin v<MAJOR>.<MINOR>.<PATCH>
```

Create a GitHub release with auto-generated notes:
```bash
gh release create v<MAJOR>.<MINOR>.<PATCH> \
  --title "v<MAJOR>.<MINOR>.<PATCH>" \
  --generate-notes
```

For release branches (Git Flow):
```bash
git checkout -b release/2.4.0 develop
# finalise, then merge to main and develop
gh pr create --base main --head release/2.4.0 --title "release: v2.4.0"
```

---

## Step 8 — Branch Cleanup

### After a PR is merged

```bash
git branch -d feature/<branch-name>         # delete local branch
git fetch origin --prune                    # remove stale remote-tracking refs
```

If GitHub auto-delete is not enabled, delete the remote branch:
```bash
git push origin --delete feature/<branch-name>
```

### Identify stale branches

```bash
git branch -r --sort=-committerdate         # list remote branches by last commit date
```

A branch is a candidate for deletion if:
- No commits in the last 30 days
- No open PR associated with it
- It has been merged into the base branch

---

## Step 9 — Conflict Resolution

### Keep a branch up to date with base

```bash
git fetch origin
git rebase origin/main
```

If conflicts occur during rebase:
```bash
# For each conflicting file:
git status                              # identify conflicting files
# Edit files to resolve conflicts — remove conflict markers (<<<<, ====, >>>>)
git add <resolved-file>
git rebase --continue
# Repeat until rebase is complete
```

To abort and return to pre-rebase state:
```bash
git rebase --abort
```

### When NOT to rebase

- The branch is shared with other contributors → use `git merge origin/main` instead
- The branch has already been pushed and others have based work on it → use merge, not rebase

---

## Quick Reference — Operation Decision Matrix

| Situation | Action |
|-----------|--------|
| Starting new work | Create branch from updated `main` |
| Finished a logical unit | Atomic commit with Conventional Commits message |
| Ready for review | Open PR with Conventional Commits title + structured body |
| PR is behind base | Rebase onto base (if unshared) or merge base in |
| PR approved, feature branch | Squash merge |
| PR approved, release branch | Merge commit |
| After merge | Delete branch, fetch --prune |
| Releasing | Determine SemVer bump from commits, tag, gh release create |

---

## Reference Files

- `references/conventional-commits.md` — Full type reference, examples, and edge cases
- `references/branch-naming.md` — Naming rules, prefix glossary, and worked examples

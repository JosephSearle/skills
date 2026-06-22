# Pre-commit Configuration Reference

> Authority: [pre-commit.com](https://pre-commit.com/) and [github.com/Yelp/detect-secrets](https://github.com/Yelp/detect-secrets)

Pre-commit runs configured hooks before every `git commit`. The three hooks in this stack are Biome (lint + format), `tsc --noEmit` (type check), and detect-secrets (credential scanning).

---

## Installation

Requires Python (already available in the agents repo environment):

```bash
pip install pre-commit detect-secrets
pre-commit install
```

`pre-commit install` writes `.git/hooks/pre-commit`. This must be run by every developer after cloning the repo — it is not automatic.

Add to `package.json` `postinstall` or document in README:
```json
{
  "scripts": {
    "prepare": "pre-commit install"
  }
}
```

---

## .pre-commit-config.yaml

```yaml
repos:
  - repo: local
    hooks:
      - id: biome
        name: Biome lint and format
        entry: npx biome check --apply
        language: system
        types: [javascript, jsx, ts, tsx]
        pass_filenames: true

      - id: tsc
        name: TypeScript type check
        entry: npx tsc --noEmit
        language: system
        pass_filenames: false

      - id: detect-secrets
        name: detect-secrets scan
        entry: detect-secrets-hook
        language: python
        args: ['--baseline', '.secrets.baseline']
        types: [text]
```

Hook execution order: Biome runs first (fastest, fixes most issues), then tsc, then detect-secrets. If Biome modifies files, the commit is blocked so the developer can review and re-stage the changes.

---

## detect-secrets baseline workflow

The baseline is a snapshot of known false positives and accepted secrets. It must be committed to the repo.

**First-time setup:**
```bash
detect-secrets scan > .secrets.baseline
git add .secrets.baseline
git commit -m "chore: add detect-secrets baseline"
```

**When detect-secrets blocks a commit with a false positive:**
```bash
# Audit the flagged secrets interactively
detect-secrets audit .secrets.baseline

# After marking as false positive in the audit:
git add .secrets.baseline
git commit --amend --no-edit
```

**When adding a new env file with intentional example secrets:**
```bash
detect-secrets scan --update .secrets.baseline
git add .secrets.baseline
```

---

## Hook behaviour table

| Condition | Biome result | tsc result | detect-secrets result | Commit |
|-----------|-------------|------------|----------------------|--------|
| Clean code, no secrets | Pass (no changes) | Pass | Pass | Allowed |
| Lint error auto-fixed | Files modified → commit blocked | — | — | Blocked (re-stage) |
| Type error | — | Non-zero exit | — | Blocked |
| Hardcoded secret | — | — | Non-zero exit | Blocked |

When Biome auto-fixes files, it modifies them but doesn't stage them. The developer must review the fixes, then `git add` and `git commit` again.

---

## Skipping hooks (emergency only)

```bash
git commit --no-verify -m "emergency: hotfix"
```

Only use with explicit team approval. The `--no-verify` flag bypasses all pre-commit hooks including secret detection.

---

## Running hooks manually

```bash
# Run all hooks on all files
pre-commit run --all-files

# Run a specific hook
pre-commit run biome --all-files
pre-commit run detect-secrets --all-files

# Run on staged files only (same as commit)
pre-commit run
```

---

## Cross-repo consistency

This configuration mirrors the agents repo's pre-commit setup. Differences are intentional:

| Setting | This repo (frontend) | Agents repo (Python) |
|---------|---------------------|---------------------|
| Biome hook | Yes | No (Python uses ruff) |
| tsc hook | Yes | No |
| detect-secrets | Yes | Yes |
| ruff | No | Yes |
| pyright | No | Yes |

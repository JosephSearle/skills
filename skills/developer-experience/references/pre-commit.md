# pre-commit Reference

**Framework version**: ≥ 4.0.0  
**Key hook versions**: ruff-pre-commit v0.15.17, uv-pre-commit 0.11.21, pre-commit-hooks v6.0.0, detect-secrets 0.13.1+ibm.64.dss

## Canonical `.pre-commit-config.yaml` for agentcraft stack

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
        args: [--maxkb=1000]

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.15.17
    hooks:
      - id: ruff           # lint first (auto-fix)
        args: [--fix]
      - id: ruff-format    # format second

  - repo: local
    hooks:
      - id: pyright
        name: pyright
        language: system
        entry: uv run pyright
        types: [python]
        pass_filenames: false

  - repo: https://github.com/ibm/detect-secrets
    rev: 0.13.1+ibm.61.dss
    hooks:
      - id: detect-secrets
        args: [--baseline, .secrets.baseline]

  - repo: https://github.com/astral-sh/uv-pre-commit
    rev: 0.11.21
    hooks:
      - id: uv-lock        # fails if uv.lock is out of date
```

## Hook execution order

`trailing-whitespace / file-fixer` → `ruff check --fix` → `ruff-format` → `pyright` → `detect-secrets` → `uv-lock`

The order matters: lint fixes can change formatting; type checking runs after both.

## detect-secrets setup

```bash
# Initial baseline (run once, then commit .secrets.baseline)
detect-secrets scan \
  --exclude-files 'tests/fixtures/.*' \
  --exclude-files 'examples/.*' \
  --use-all-plugins \
  > .secrets.baseline

# Interactive audit — mark true/false positives
detect-secrets audit .secrets.baseline
git add .secrets.baseline

# Re-scan when baseline drifts (hook errors but audit says nothing to audit)
detect-secrets scan --update .secrets.baseline
```

### LLM codebase false positive management

High-entropy false positives are common from API key placeholders, base64 examples, and prompt fixtures:

```python
SECRET_KEY = "your-api-key-here"  # pragma: allowlist secret
```

Exclude entire directories:
```bash
detect-secrets scan \
  --exclude-files 'tests/fixtures/.*' \
  --exclude-files 'prompts/examples/.*' \
  --no-keyword-scan \            # disable for repos heavy on prompt text
  --baseline .secrets.baseline
```

Use the IBM fork (`ibm/detect-secrets`) — the Yelp upstream and IBM fork have diverged; the IBM
fork provides `AWSKeyDetector`, `GitHubTokenDetector`, `IbmCloudIamDetector` plugins.

## CI backstop (non-negotiable)

Agent coding tools bypass local git hooks with `--no-verify`. Always add to CI:

```yaml
- run: uvx pre-commit run --all-files
```

## Keeping hooks current

```bash
# Update all hook revs to latest
uvx pre-commit autoupdate

# Run on a schedule in CI (monthly) to prevent version drift
```

Version drift between `pyproject.toml` pinned deps and hook `rev` is a common footgun.
The `uv-lock` hook catches lockfile drift; `pre-commit autoupdate` catches hook version drift.

## Isolated hook venvs

pre-commit creates isolated venvs for each repo entry. This means `language: python` hooks cannot
see project dependencies. Always use `language: system` + `uv run` for project-aware tools
(Pyright, custom scripts that import project code).

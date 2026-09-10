# Review policy

This file defines what to look for when reviewing changes in this repo (by hand or via `/code-review`), and how to weigh findings. It is a policy document, not a CI gate — human code-owner approval is still required to merge; findings inform that decision, they don't replace it.

## Review passes

1. **Correctness bugs** — logic errors, broken edge cases, things that will misbehave at runtime (`site/`) or produce a bad catalog entry (`catalog/`).
2. **Security** — secrets committed, unsafe file/path handling in build scripts (`site/scripts/*.mjs` walk the filesystem and write zip archives — path traversal or symlink issues matter here), unvalidated input reaching a shell or the filesystem.
3. **Policy/compliance** — does the change respect the structural rules this repo already enforces in CI:
   - `SKILL.md` frontmatter has `name`, `description`, `summary` (gated by `build:index`, see `CLAUDE.md`).
   - `evals.json` (if present) is structurally valid (gated by `validate:evals`).
   - No hand-edits to gitignored generated output (`site/generated/`, `site/public/downloads/`, `site/out/`).

## Important vs. Nit

- **Important**: would break behavior (site fails to build, a skill fails to load, an eval file breaks CI), leak data (a committed secret or credential), or breach one of the policies above. Raise these as blocking.
- **Nit**: style, naming, or preference with no functional impact. Mention them, but they should never block a merge on their own.

Exclude generated files (`site/generated/`, `site/public/downloads/`, `site/out/`) and anything already caught by CI (lint, typecheck, `build:index`, `validate:evals`, tests, e2e) from manual review — don't re-litigate what a deterministic check already gates.

## Tooling

Use `/code-review` for a standard pass on the current diff, and `/code-review ultra` for a deeper multi-agent review before merging a larger or riskier change (e.g. changes to `site/scripts/build-skills-index.mjs`, `.github/workflows/*`, or anything touching how skills are packaged). There is currently no automated PR review running in CI — this is done on demand.

## Follow-up (not yet in place)

- No `CODEOWNERS` file exists yet; branch protection currently relies on manual review discipline. Consider adding one if the contributor base grows.

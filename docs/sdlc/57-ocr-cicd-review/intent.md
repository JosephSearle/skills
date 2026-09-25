---
author: Joseph Searle
status: draft
linked_issue: https://github.com/JosephSearle/skills/issues/57
created: 2026-09-25
---

# Intent: Add Open Code Review (OCR) as a CI check for automated PR review

## Problem

PRs in this repo currently get no automated substantive-code-review pass — only mechanical gates
(`lint-format`, `typecheck`, `unit-tests`, `build-index`, `validate-evals`, `e2e` in
`.github/workflows/ci.yml`). Nothing today gives reviewers a first pass at correctness bugs or
security issues before a human looks at the diff, and nothing structurally distinguishes "this
needs a harder look" (a potential vulnerability or bug) from routine style feedback.

## Proposed outcome

Every PR against this repo is automatically reviewed by OCR (`alibaba/open-code-review`) via a new
GitHub Actions workflow:

- OCR posts informative inline review comments on the PR diff for findings in general.
- The PR is **blocked** (the check fails) when OCR detects a **critical bug or vulnerability** in
  the change list — this is the one class of finding that should stop a merge, not just get a
  comment.
- Review focus is driven by [OCR's Review Rules pattern](https://open-codereview.ai/docs/review-rules)
  (`.opencodereview/rule.json` committed to the repo) rather than ad hoc prompt text, so what
  counts as "needs a harder look" is versioned, reviewable, and consistent across runs — not
  re-decided per PR.
- A per-run token budget (`--max-tokens-budget` / the action's `max_tokens_budget` input) caps
  spend on any single review, so cost stays bounded and predictable.

## Affected users and systems

- **All contributors** opening PRs against this repo — the check runs on every PR, not scoped to
  just `catalog/` or just `site/`.
- **CI pipeline** (`.github/workflows/`) — adds a new workflow alongside the existing `ci.yml`.
- **Repo config** — adds `.opencodereview/rule.json` (project-level review rules, committed) and
  new GitHub Actions secrets/variables for LLM credentials and the token budget.
- **PR review process** — a failing OCR check becomes part of what "green" means for a PR, same
  status as the existing CI gates described in `CLAUDE.md`.

## Constraints

- **LLM provider**: most likely Claude (Anthropic). Exact model and `OCR_LLM_USE_ANTHROPIC` /
  `OCR_LLM_MODEL` values TBD at Design time.
- **Cost ceiling**: enforced via a max-token-budget value (`OCR`'s `--max-tokens-budget` /
  `max_tokens_budget` action input) — the exact numeric value is TBD, to be sized during Design.
  No dollar-based ceiling; the token budget is the mechanism.
- **Blocking behavior**: the check must fail the PR when a critical bug/vulnerability is found, but
  must not fail the PR for lower-severity/informational findings — those should surface as comments
  only, not as a merge blocker.
- Review rules live in `.opencodereview/rule.json` (project layer, priority 2 in OCR's four-layer
  chain) rather than a `--rule` CLI override, so they're versioned and reviewable like any other
  repo config.
- Keeps the same exclusions already scoped out in issue #57: no branded GitHub App bot identity, no
  SARIF/Code Scanning upload, no GitLab CI variant — GitHub Actions only.

## Open questions

- **Severity → blocking mechanism**: the Review Rules page documents how rules route *what* OCR
  focuses on per file, but not a severity/category schema for findings. Blocking on
  "critical bug or vulnerability" will need the CI script to parse per-finding severity out of
  OCR's `--format json` output (see the CLI Reference's JSON envelope) and fail the job
  conditionally — needs to be confirmed against that schema during Design.
- **Exact token budget value**: confirmed the mechanism (max-token-budget), but not the number —
  needs sizing during Design (e.g. against expected PR diff sizes and Claude pricing).
- **Exact Claude model**: "most likely Claude" — which model (and whether `OCR_LLM_USE_ANTHROPIC`
  is the right flag vs. an OpenAI-compatible proxy) is still open.
- **Contents of `.opencodereview/rule.json`**: this intent establishes that rules will be used and
  committed, not the actual rule set — drafting the rules themselves (which paths need a "harder
  look," e.g. auth code, `site/` API routes, catalog validation scripts) is Design-stage work.
- **Fork PRs**: whether the check should still block on fork-originated PRs, where `GITHUB_TOKEN`
  permissions and secret availability differ (`pull_request_target` is required for secrets to be
  available at all — see issue #57's proposed implementation).

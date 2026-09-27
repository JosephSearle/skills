---
status: draft
linked_intent: docs/sdlc/57-ocr-cicd-review/intent.md
persona: personal
skills_applied: [security-baseline, brand-personal, ux-personal, compliance-gdpr, compliance-eu-ai-act]
created: 2026-09-27
---

# Spec: Add Open Code Review (OCR) as a CI check for automated PR review

## Requirements

1. A new GitHub Actions workflow runs `alibaba/open-code-review` (the `ocr` CLI, via its
   published composite action) against every pull request opened against this repo — not scoped
   to `catalog/**` or `site/**` path filters like `ci.yml`, since a review pass has value on any
   change (docs, workflows, config).
2. OCR posts inline PR comments for findings in general (informational).
3. The check **fails** (blocks the PR going green) when OCR reports at least one
   **critical-severity** finding on the diff. Every other severity/category is comment-only and
   must never fail the job.
4. Review focus is driven by a committed `.opencodereview/rule.json` (project layer), not ad hoc
   prompt text or a `--rule` override passed only at CLI-invocation time.
5. A `max_tokens_budget` value caps spend per run.
6. LLM credentials are supplied via a repo secret, never committed or hardcoded.

## Design approach

### Workflow file

New file: `.github/workflows/ocr.yml`, separate from `ci.yml` (different trigger scope, different
concerns — a review-quality gate, not a mechanical correctness gate).

```yaml
name: OCR
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ocr-${{ github.workflow }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Run OpenCodeReview
        uses: alibaba/open-code-review@<pin-to-release-tag>   # see Areas of concern: dependency pinning
        with:
          llm_url: https://api.anthropic.com                  # confirm exact base URL against OCR docs at Build time
          llm_auth_token: ${{ secrets.ANTHROPIC_API_KEY }}
          llm_model: claude-haiku-4-5-20251001                 # see "Exact Claude model", below
          llm_use_anthropic: true
          rule: .opencodereview/rule.json
          max_tokens_budget: 350000                            # see "Exact token budget value", below
          upload_artifacts: true                               # keep default: audit trail for section 5 (vuln/incident response)

      - name: Block PR on a critical-severity finding
        if: always()
        run: |
          node .github/scripts/ocr-check-critical.mjs /tmp/ocr-result.json
```

`alibaba/open-code-review`'s composite action does its own checkout, PR-head fetch, and
merge-base computation internally — the calling workflow does not need its own `actions/checkout`
step first. Its `Run OpenCodeReview` step already fails the job (non-zero exit) on a tool-level
error (auth failure, timeout, etc.) via its own "Fail job on OCR error" step; the second step
above is purely for the severity-based blocking policy this spec adds on top, and only makes
sense to run when the first step actually produced a result file — the `if: always()` above is a
placeholder for "ran and produced a result," to be tightened to the action's actual exit-status
output once confirmed at Build time (see Open questions resolved, item 1).

### Severity-based blocking (`.github/scripts/ocr-check-critical.mjs`)

Confirmed directly from the action's own source (`action.yml`) that **the action does not expose
a per-severity output** — its `outputs` are aggregate counts only (`comments_total`,
`comments_inline`, `comments_routed`, `comments_failed`, etc.), with no `comments_critical` or
equivalent. The action does, however, run `ocr review --format json` internally and write the
full result to `/tmp/ocr-result.json` on the same runner, in the same job — so a follow-up step
in the same job can read that file directly without needing to download an artifact.

Design: a small Node script, `.github/scripts/ocr-check-critical.mjs`, that:
- Reads `/tmp/ocr-result.json`.
- Counts findings whose severity is `critical` (the four-value vocabulary — `critical`, `high`,
  `medium`, `low` — is confirmed from the action's own `route_severity_below` input; the exact
  JSON field name/path for a finding's severity within the result file still needs confirming
  against a real `ocr review --format json` output at Build time — see Open questions resolved,
  item 1).
- On any critical finding: prints which file(s)/finding(s) triggered it (what went wrong) and
  points at the posted PR comments for detail (what to do about it), per brand-personal's
  error-message ordering, then exits non-zero.
- On zero critical findings: exits 0, prints nothing (ux-personal: silent on success for
  scriptable/CI tooling).

### `.opencodereview/rule.json` — starter scope

Concrete rule content is Design-stage work per the intent, so this spec proposes a starting rule
set rather than leaving it as a placeholder. Based on this repo's actual sensitive surfaces:

- `.github/workflows/**` — flag any change that widens `permissions:`, adds a new secret
  reference, or interpolates an untrusted context expression (e.g. `github.event.pull_request.*`)
  directly into a `run:` shell block (script-injection risk) as critical.
- `site/scripts/build-skills-index.mjs` — flag unsanitized path handling when reading `catalog/`
  or writing `site/public/downloads/*.skill`.
- `site/app/skills/[slug]/[file]/page.tsx` (and any sibling dynamic route reading off disk via
  `CATALOG_ROOT`) — flag any change to slug/file param handling that doesn't keep resolved paths
  inside `CATALOG_ROOT` (path traversal).
- `catalog/*/SKILL.md` frontmatter parsing (`gray-matter` usage in `build-skills-index.mjs`) —
  flag any change away from safe YAML loading.

The exact `rule.json` schema (field names OCR expects) should be validated against a real file
during Build — this spec establishes the paths and risk classes to encode, not the literal JSON
keys.

### Secret

`ANTHROPIC_API_KEY` (SCREAMING_SNAKE_CASE per brand-personal naming conventions), added as a
repo-level GitHub Actions secret — never committed, injected at runtime only, per
security-baseline section 1.

## Open questions resolved

- **Severity → blocking mechanism** (intent, open question 1): Resolved at the mechanism level —
  confirmed via the action's own `action.yml` that no native block-on-severity output exists, so
  blocking must be a custom follow-up step reading the action's own JSON result file
  (`/tmp/ocr-result.json`) in the same job. The literal per-finding JSON field names are **carried
  forward**: still need confirming against a real `ocr review --format json` run before
  `.github/scripts/ocr-check-critical.mjs` can be finalized.
- **Exact token budget value** (intent, open question 2): Resolved with data — the last 8 merged
  PRs on `main` ranged from ~230 to ~2,900 changed lines (`git diff --shortstat` across each merge
  commit's parents), with most well under 1,000. Sized `max_tokens_budget: 350000` against the
  observed worst case plus headroom for multiple LLM calls per file group and review-output
  tokens; this is a starting point to retune after a few real runs against actual token usage in
  `ocr-result.json`, not a final number.
- **Exact Claude model** (intent, open question 3): Recommending `claude-haiku-4-5-20251001` as
  the default — this repo's diffs are markdown/config/scripts, not algorithmically complex code,
  and the intent's stated cost sensitivity ("no dollar-based ceiling, the token budget is the
  mechanism") favors the cheaper model as a default. `llm_model`/`OCR_LLM_MODEL` is a
  one-line swap if review quality proves insufficient — not a one-way door.
- **Contents of `.opencodereview/rule.json`** (intent, open question 4): Resolved at the scoping
  level — see Design approach's starter rule set above, covering this repo's actual
  security-sensitive surfaces (workflow files, the catalog-index build script, the dynamic
  file-serving route, frontmatter parsing). Literal schema keys carried forward to Build, as
  above.
- **Fork PRs** (intent, open question 5): Resolved — trigger on plain `pull_request`, not
  `pull_request_target`. GitHub does not pass repository secrets to `pull_request` runs
  originating from a fork, so `ANTHROPIC_API_KEY` is never exposed to a fork-authored workflow
  run; the practical effect is that OCR simply won't run (no credential available) on a
  fork-originated PR, rather than running with elevated trust. `pull_request_target` would make
  secrets available for fork PRs too, but only by running the workflow in the base repo's trust
  context against untrusted fork code — a known-risky pattern security-baseline's section 2
  ("treat third-party executable code as untrusted until vetted") argues against by default. This
  repo has no external-contributor base today, so the safer default (no review on fork PRs) costs
  nothing in practice; revisit if that changes.

## Areas of concern

- **security-baseline (§1, dependency pinning)**: `uses: alibaba/open-code-review@<tag>` in the
  workflow above is a placeholder — pin to a specific release tag or commit SHA (not `@main` or a
  floating major-version tag) before merging. Confirm the current stable release at Build time.
- **security-baseline (§4, data handling)**: every PR's diff — plus, unavoidably, git commit
  metadata (author name/email) as part of the diff context — is sent to Anthropic's API for
  review. For a solo personal repo this is Joseph's own data by default, but if this repo ever
  takes an external contribution, that contributor's commit metadata leaves the repo boundary to
  a third-party model with no explicit notice to them beyond this being visible as a public CI
  check. Not a blocker given the repo's current scope, but named explicitly rather than silently
  assumed away, per baseline's instruction not to resolve data-handling gaps quietly.
- **compliance-gdpr**: directly downstream of the point above — if a future PR is opened by
  someone other than Joseph, their commit author name/email (personal data) is processed by a
  third-party (Anthropic) as part of this workflow, with no lawful-basis determination made here
  and no disclosure mechanism beyond "the workflow is visible in the repo." Low risk at solo-repo
  scale; needs a real answer (most likely: legitimate-interests basis, disclosed via
  `CONTRIBUTING.md`) before this repo accepts outside contributions. Product owner: confirm
  whether that's in scope now or deferred until the repo actually opens to outside contributors.
- **compliance-eu-ai-act**: classified as **minimal risk** — a deployer (not provider) use of a
  foundation model for developer-productivity code review, none of the Article 5
  sensitive-domain categories (biometrics, critical infrastructure, employment, essential
  services, law enforcement, migration, justice) apply, and OCR's role stays at
  comment-and-block-a-status-check — it never merges, auto-modifies code, or takes an
  irreversible action on its own. No mandatory obligations under the four-tier classification. If
  a later change ever gives OCR (or a similar agent) write/merge authority instead of
  comment-only authority, this classification should be revisited — that would move the action
  layer's risk profile up, per the Act's agentic-scope section.
- **ux-personal (§4, API/developer UX)**: `.github/scripts/ocr-check-critical.mjs`'s failure
  output is the only human-facing surface this change adds — it must state what triggered the
  block and where to look (the PR's inline comments / summary), not just exit non-zero with no
  context, per the design above. Flagging this so it isn't dropped as trivial during Build.
- **brand-personal**: no collisions found. Naming (`ocr.yml`, `ANTHROPIC_API_KEY`,
  `.opencodereview/rule.json`) already fits kebab-case/SCREAMING_SNAKE_CASE conventions or is
  dictated by the third-party tool's required path (exception per brand-personal §2, not a
  violation).

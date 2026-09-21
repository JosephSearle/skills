# Runbook: Adding a Skill to the Catalog

**Type:** Runbook (fixed sequence). Adding a skill to `catalog/` always follows the same steps —
if you find yourself needing to make a judgment call partway through, stop and check
[CONTRIBUTING.md](../../CONTRIBUTING.md#suggesting-an-enhancement) instead; this doc assumes the
skill's scope and behavior are already decided.

## Trigger

You're about to add a new skill directory under `catalog/`, or substantially rewrite an existing
one's `SKILL.md`.

## Prerequisites

- A local clone with `site/` dependencies installed (`cd site && npm install`).
- Node installed (whatever version `site/package.json` targets).
- If this is a new skill (not a small fix): per CONTRIBUTING.md's
  [Minor vs. major changes](../../CONTRIBUTING.md#minor-vs-major-changes), open an issue first to
  agree on scope before writing it — skip this step only for typo/wording fixes.

## Steps

1. **Create the skill directory.**
   ```bash
   mkdir catalog/<skill-name>
   ```
   Use a kebab-case name matching the skill's purpose (see existing folders in `catalog/` for
   convention).

2. **Write `catalog/<skill-name>/SKILL.md`** with YAML frontmatter containing all three required
   fields — `name`, `description`, `summary` — plus a markdown body. Copy the shape of an existing
   skill (e.g. `catalog/changelog/SKILL.md`) as your template rather than starting from a blank
   file. Expected result: the file parses as valid frontmatter + markdown (you'll confirm this in
   step 4).

3. **Add optional subfolders if needed:** `references/` (supporting docs), `scripts/` (helper
   scripts), `evals/` (an `evals.json` — see step 5 if you add this).

4. **Regenerate and validate the index**, from `site/`:
   ```bash
   npm run build:index
   ```
   Expected result: a one-line success summary, exit 0. This both validates your `SKILL.md`
   frontmatter and regenerates `site/generated/skills-index.json` plus the downloadable
   `site/public/downloads/<skill-name>.skill` archive. **Do not hand-edit either of those
   outputs** — they're gitignored build artifacts regenerated from `catalog/`.

5. **If you added `evals/evals.json`**, validate it structurally, from `site/`:
   ```bash
   npm run validate:evals
   ```
   Expected result: a one-line success summary, exit 0. (This checks structure only — it does not
   execute the evals against a model.)

6. **Run the full local check suite**, from `site/`, matching what CI gates on:
   ```bash
   npm run lint:ci
   npm run typecheck
   npm run test
   ```
   Expected result: `lint:ci` and `typecheck` print nothing on success; `test` prints a passing
   summary (e.g. `N passed`) with no failures.

7. **Test the skill actually works, not just that it parses.** Structural validation
   (steps 4–5) confirms the file is well-formed; it says nothing about whether Claude will
   actually invoke and follow it correctly. To test the behavior itself:
   - Make the skill locally available to a Claude Code session: copy or symlink it into
     `.claude/skills/` (this repo intentionally doesn't keep a permanent copy there — see
     [CLAUDE.md](../../CLAUDE.md)):
     ```bash
     ln -s "$(pwd)/catalog/<skill-name>" .claude/skills/<skill-name>
     ```
   - Start a session and exercise the trigger phrases from your `description` field — confirm
     Claude actually picks the skill up for the prompts you expect, and ignores it for prompts
     that shouldn't trigger it (a description that's too broad will misfire on unrelated
     requests).
   - Walk through the skill's own body as if you were Claude following it, on at least one
     realistic example, to confirm the steps produce the intended result end-to-end — not just
     that they read sensibly.
   - If you added `evals/evals.json`, this is also where you'd run those evals against a model
     (not just the structural check from step 5) if your workflow supports it; `validate:evals`
     alone does not execute them.
   - Remove the symlink/copy from `.claude/skills/` when done, unless you deliberately want it
     kept available locally.

8. **Check the rendered site UI, not just that the build succeeds.** From `site/`:
   ```bash
   npm run dev
   ```
   `predev` regenerates the index automatically. Then, in a browser:
   - Confirm your skill appears in the catalog listing (`/`) with the correct name and summary.
   - Open the skill's own page (`/skills/<skill-name>`) and confirm the rendered markdown body
     looks right (headings, code blocks, lists) — a frontmatter or markdown quirk that passes
     `build:index`'s structural check can still render oddly on the page.
   - If you added `references/`, click through to at least one reference file's page
     (`/skills/<skill-name>/<file>`) and confirm it renders.
   - Confirm the download link produces a working `.skill` archive.
   - Stop the dev server when done.

   For a closer match to production, you can instead run `npm run build && npm run test:e2e`
   (Playwright against the static export) — heavier, but catches anything specific to the static
   build that `dev` mode might not.

9. **Commit and open a PR against `main`**, keeping the change scoped to the skill itself (a skill
   change and a `site/` change belong in separate PRs per CONTRIBUTING.md's ground rules). CI runs
   `lint-format`, `typecheck`, `unit-tests`, `build-index`, `validate-evals`, and `e2e` on the PR —
   all must pass before merge.

## Rollback / Escalation

- **`build:index` fails with a `process.exit(1)` and a bullet list of errors** (e.g.
  `- "<slug>": missing required field "summary"`): this means your `SKILL.md` frontmatter is
  malformed or missing a required field. Fix the listed file directly — don't work around the
  script or edit generated output.
- **`validate:evals` fails**: fix the structure of `catalog/<skill-name>/evals/evals.json` per the
  error message.
- **`lint:ci` or `typecheck` fails**: run `npm run format` (auto-fixes what Biome can) and rerun;
  fix remaining typecheck errors directly.
- **Still stuck, or the failure doesn't match any case above**: open an issue describing what step
  failed and the exact error output (see CONTRIBUTING.md's
  [Reporting a bug](../../CONTRIBUTING.md#reporting-a-bug) for what to include), or ask in the PR
  thread — a maintainer reviews every PR before merge.
- **You're unsure whether what you're building is actually a runbook-shaped task at all** (e.g.
  you're trying to decide *whether* to add a skill, or how to scope one): that's a design
  decision, not this procedure — see CONTRIBUTING.md's
  [Suggesting an enhancement](../../CONTRIBUTING.md#suggesting-an-enhancement) instead.

## Related links

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — full contribution ground rules, PR process, and style
  guide this runbook is derived from.
- [README.md#skill-structure](../../README.md) — the required `SKILL.md` structure in full.
- [REVIEW.md](../../REVIEW.md) — what a review of your change looks for.
- [CLAUDE.md](../../CLAUDE.md) — repo architecture (how a skill becomes a page).
- `.github/workflows/ci.yml` — the exact CI jobs this runbook's steps mirror.

**Discovery:** link this doc from CONTRIBUTING.md's "Getting started" section so it's found before
someone starts, not after they're stuck.

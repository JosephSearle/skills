# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This repo has two independent parts:

- **`catalog/`** — the actual skill content. Each subdirectory is one skill: a `SKILL.md` with YAML frontmatter (`name`, `description`, `summary` are all required) plus a markdown body, and optional `references/`, `scripts/`, `evals/` subfolders.
- **`site/`** — a standalone Next.js 15 (App Router, static export) app that reads `catalog/` and publishes it as a browsable, downloadable catalog. It has its own `package.json`/lockfile; there is no root-level `package.json` or workspace tooling.

Everything below (`npm` commands, lint, tests) runs from inside `site/`.

Note: there is no separate `.claude/skills/` copy for the Claude Code harness in this repo — skills are loaded from `catalog/`. If a session needs a skill available locally under `.claude/skills/`, copy or symlink it there deliberately; don't assume it's already present.

## Working agreements

- When Claude makes the same mistake twice in this repo, the correction goes into this file, not just chat memory.
- Deliberately deferred (not built, so it isn't silently re-litigated): hooks-as-approval-gates in `.claude/settings.json` (no protected-path risk here beyond what CI already gates), multi-tier production deploy autonomy and rehearsed rollback (this is a static site with a single Vercel prod target, gated on CI success on `main` — see CI/CD below), and statistical anomaly detection on operational metrics (no stable rolling metric exists yet to baseline against). Revisit any of these if the repo's risk profile changes.

## Commands (run from `site/`)

```bash
npm run dev          # next dev (regenerates the skills index first via predev)
npm run build         # next build -> static export to site/out (regenerates index first via prebuild)
npm run build:index    # node scripts/build-skills-index.mjs — regenerate site/generated/skills-index.json and site/public/downloads/*.skill from catalog/
npm run validate:evals  # node scripts/validate-evals.mjs — structural check of catalog/*/evals/evals.json (does not execute evals against a model)
npm run typecheck     # tsc --noEmit
npm run lint          # biome check . (writes nothing)
npm run lint:ci        # biome ci . — non-mutating, what CI runs
npm run format         # biome format --write .
npm run test           # vitest run (unit tests)
npm run test:e2e        # playwright test — requires a production build first (webServer config serves site/out via `npx serve`)
```

Run a single vitest test file: `npx vitest run scripts/build-skills-index.test.mjs`. Run a single Playwright test: `npx playwright test e2e/smoke.spec.ts -g "homepage lists"`.

`site/generated/`, `site/public/downloads/`, `site/out/`, and `site/node_modules/` are gitignored build artifacts — never hand-edit them.

**What a healthy run looks like:** `build:index` and `validate:evals` print a one-line success summary and exit 0 on success; a thrown validation error plus `process.exit(1)` (with a `  - "<slug>": ...` bullet list) means a `SKILL.md` or `evals.json` is malformed — fix the listed file, don't work around the script. `lint:ci` and `typecheck` print nothing on success. `test` and `test:e2e` print a passing summary (e.g. `N passed`) with no failed/red entries.

## Architecture: how a skill becomes a page

1. **`site/scripts/build-skills-index.mjs`** scans `catalog/` for subdirectories that directly contain a `SKILL.md`. For each one it parses frontmatter (via `gray-matter`), validates the three required fields (throwing and `process.exit(1)`-ing on failure — this is the CI gate for bad skill content), and writes:
   - `site/generated/skills-index.json` — one `SkillEntry` per skill (slug, name, summary, description, markdown body, `references[]`, `hasScripts`/`hasEvals` flags, a flattened `archiveTree`, and the download path/size).
   - `site/public/downloads/<slug>.skill` — a zip of the whole skill folder (via `archiver`), served as the download.
   - This script runs standalone with Node (not through Next/TypeScript), so it independently re-derives the repo-root → `catalog/` relationship that `site/lib/repo-root.ts` (`CATALOG_ROOT`) encodes for the rest of the app — if that relationship ever changes, both places need updating.
2. **`site/lib/skills-index.ts`** is the only place the generated JSON is imported; `getAllSkills()`/`getSkillBySlug()` are how every page reads catalog data. Nothing else should import `site/generated/skills-index.json` directly.
3. Next.js pages are statically generated from that index: `app/page.tsx` (catalog listing), `app/skills/[slug]/page.tsx` (one skill), `app/skills/[slug]/[file]/page.tsx` (renders a single reference file — this route reads the reference's markdown straight off disk via `CATALOG_ROOT`, *not* from the generated JSON, since only the body of `SKILL.md` itself is embedded in the index).
4. `output: 'export'` in `next.config.mjs` means the whole site builds to static HTML in `site/out/` — there is no server runtime in production.

Because the index and archives are build-time artifacts, **adding, editing, or removing a skill under `catalog/` requires no frontend code changes** — the next `npm run build` (or `predev`/`prebuild` hook) picks it up automatically.

## CI/CD

- `.github/workflows/ci.yml` runs on PRs/pushes touching `site/**` or `catalog/**`: parallel `lint-format`, `typecheck`, `unit-tests`, `build-index` (validates every `SKILL.md` in `catalog/`, gating on the same exit-1 behavior described above), `validate-evals` (structurally validates every `catalog/*/evals/evals.json`, see `npm run validate:evals` above), and `e2e` (needs `build-index`, runs a full `next build` then Playwright against the static export).
- `.github/workflows/deploy.yml` triggers on a successful CI run on `main` and deploys `site/` to Vercel via the Vercel CLI; it needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` repo secrets to actually deploy.

## Review policy

See `REVIEW.md` for what to look for when reviewing a change (correctness, security, policy/compliance) and how to weigh findings (Important vs. Nit). Use `/code-review` for a standard pass, `/code-review ultra` for a deeper one before riskier changes.

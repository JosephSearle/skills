## Summary

<!-- One line, imperative mood: "Add the X skill" / "Fix Y validation bug" / "Tighten Z eval".
     This becomes the PR title and the changelog entry, so write it as you'd want it read in
     `git log` a year from now — not "This PR adds..." or "Adding...". -->

## Why

<!-- What problem does this solve, or what does it enable? If there's an issue for this, link it
     below rather than repeating the context here. If you considered another approach and rejected
     it, say why — that's the part a diff alone can't show a future reader. -->

## What changed

- [ ] `catalog/` (skill content)
- [ ] `site/` (Next.js app)

<!-- Per CONTRIBUTING.md's ground rules, a catalog change and a site change are usually better as
     separate PRs — if this touches both, say why below. -->

## Linked issue

<!-- Closes #123 / Fixes #123 — only works if this PR merges into `main` (this repo's default
     branch), which is the normal case here. Per CONTRIBUTING.md, a new skill, a behavior change,
     or a site-architecture change should already have an issue from the "talk through the
     approach first" step; a small typo/wording fix doesn't need one. -->

## Checks

<!-- From `site/`, per CONTRIBUTING.md's "Getting started" section: -->

- [ ] `npm run build:index` (validates every `SKILL.md`, regenerates the index/downloads)
- [ ] `npm run validate:evals` (if this PR touches `catalog/*/evals/evals.json`)
- [ ] `npm run lint:ci`
- [ ] `npm run typecheck`
- [ ] `npm run test`

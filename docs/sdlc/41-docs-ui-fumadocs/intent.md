---
author: Joseph Searle
status: draft
linked_issue: https://github.com/JosephSearle/skills/issues/41
created: 2026-09-21
---

# Intent: Docs UI for docs/ with Fumadocs

## Problem
Contributors have no browsable UI for the `docs/` directory (repo/process docs such as
`docs/sdlc/*` artifacts, and other contributor-facing documentation). Today that content can
only be read as raw markdown files in the repo — there's no navigation, search, or rendered
reading experience for it. This is distinct from `site/`, which already renders the skill
catalog (`catalog/`) — `docs/` has no equivalent.

## Proposed outcome
A docs UI built with Fumadocs that reads from `docs/` and gives internal contributors sidebar
navigation and full-text search over that content, deployed somewhere reachable (not just
runnable locally) so contributors don't need to check out the repo to read it.

## Affected users and systems
- **Users**: internal contributors to this repo (not external/public catalog visitors).
- **Systems**: a new app/tooling reading `docs/`. Explicitly does not touch `site/`, `catalog/`,
  or the existing skill-catalog build pipeline (`build-skills-index.mjs`, `skills-index.json`,
  etc.) — this is a separate, independent build/deploy path.

## Constraints
- Framework choice is settled: Fumadocs (chosen for extensibility).
- Must be built and deployed independently of `site/`'s existing pipeline — no wiring into
  `site/`'s npm scripts, CI jobs, or build-index flow.
- No other hard constraints (deployment target, timeline, hosting) have been decided yet.

## Open questions
- Deployment target for the new fumadocs app is not yet decided (e.g. Vercel alongside `site/`,
  a separate project, etc.).
- GitHub issue #41 is currently titled as a "Spike: evaluate a docs UI framework" — the
  originator says this framing is stale/incorrect and the actual intent here is to build with
  Fumadocs directly, not evaluate options. The issue title/description should be corrected to
  match before or during review, so reviewers aren't misled by the spike framing.

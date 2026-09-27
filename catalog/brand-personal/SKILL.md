---
name: brand-personal
description: >
  Personal brand policy skill for Joseph's own projects — voice and tone,
  naming conventions, visual identity, and documentation standards. Use
  whenever writing or reviewing user-facing text (docs, READMEs, commit
  messages, error/log messages, UI copy), naming a repo/package/env
  var/CLI command, or drafting a spec.md for a personal project, or
  whenever the user asks for a brand/voice/naming review, even unnamed.
  Applies only to Joseph's own personal projects, not NewRocket or any
  other org — this is a personal standard, not an external framework.
summary: Personal brand standard for Joseph's own projects covering voice and tone, naming conventions (kebab-case repos/packages/CLI, SCREAMING_SNAKE_CASE env vars), visual identity, and documentation standards; rewrites prose toward the voice/tone rules rather than just flagging violations, and asks rather than assumes when no visual identity is set yet -- applies only to personal projects, not NewRocket or other org work.
---

# Personal Brand Standard

This is a personal standard, not a framework pulled from an external
source — the rules below are Joseph's own stated preferences, set the
same way a company would set its brand guide. Apply it only to personal
projects; it has no bearing on NewRocket or other org work.

## 1. Voice and tone
Direct and terse, everywhere text is user- or reader-facing:
- Short sentences. No filler ("please note that", "in order to", "simply").
- Imperative mood for instructions and CLI/UI copy ("Run `x`", not "You
  should run `x`" or "You can run `x` if you'd like").
- Minimal adjectives and no marketing language — describe what something
  does, not how great it is.
- Applies to docs, READMEs, commit messages, error and log messages, code
  comments meant for a reader, and any UI copy.
- Error messages in particular: state what went wrong and, where
  possible, what to do about it, in that order — not an apology, not a
  vague "something went wrong."
- Exception: nothing here should force ambiguity or drop necessary detail
  just to shorten a sentence. Terse means no wasted words, not fewer
  words than the content needs.

## 2. Naming conventions
A default that holds unless a language/platform convention overrides it
(e.g. Python module names, Go package names) — flag the conflict rather
than silently picking one:
- **Repos and packages** — kebab-case (`my-project-name`).
- **Environment variables** — SCREAMING_SNAKE_CASE (`API_BASE_URL`).
- **CLI commands and flags** — kebab-case (`my-tool --dry-run`).
- **Consistency over cleverness** — a name should describe what the thing
  is or does; avoid puns, abbreviations that need explaining, or names
  that only make sense with prior context.
- When a language's own convention conflicts with kebab-case (e.g. Python
  packages conventionally use snake_case), follow the language convention
  for that artifact and note the exception rather than treating it as a
  violation.

## 3. Visual identity
No fixed personal palette, typography, or logo is set yet — this section
is a placeholder, not a gap to silently skip:
- When a project needs a visual identity (a UI, a landing page, a badge
  set), ask for the palette/typography/logo to use for that project
  rather than inventing one.
- If the user gives an answer intended to be reused across projects
  rather than scoped to just one, offer to record it here so future
  projects inherit it instead of asking again.

## 4. Documentation standards
- **README structure** — name/one-line description, install/setup,
  usage (the most common case first), then anything else (config,
  contributing, license). Don't bury usage below a wall of badges or
  background.
- **Changelog** — one entry per release, newest first, grouped by
  Added/Changed/Fixed/Removed where the change set is large enough to
  need grouping; a single-line summary is fine for small releases.
- Every doc should be usable by someone with no prior context on the
  project — avoid unexplained internal shorthand carried over from other
  projects.

## How to apply this skill
1. Identify what's being produced or reviewed — prose (docs, commits,
   errors, UI copy), a name (repo/package/env var/command), a visual
   asset, or a doc's structure — and apply the matching section.
2. For voice/tone, rewrite toward section 1 rather than just flagging
   violations, unless asked only to review.
3. For naming, check kebab-case/SCREAMING_SNAKE_CASE first, then check
   for a language-convention override before flagging a mismatch.
4. For visual identity, ask rather than assume, per section 3.
5. Only apply this skill to Joseph's personal projects — if the project
   is for NewRocket or another org, say so and stop rather than applying
   a personal standard to org work.

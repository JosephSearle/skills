---
name: ux-personal
description: >
  Personal UX policy skill for Joseph's own projects — CLI/terminal UX,
  web/app UI patterns, a WCAG 2.1 AA accessibility baseline, and
  API/developer UX. Use whenever designing or reviewing a CLI's flags and
  output, a web/app UI or component, a public API or library's
  interface, or drafting a spec.md for a personal project with a
  user- or developer-facing surface, or whenever the user asks for a
  UX/accessibility/DX review, even unnamed. Applies only to Joseph's own
  personal projects, not NewRocket or any other org — this is a personal
  standard, not an external framework. Cross-references the brand-personal
  skill for voice/tone in UI copy and error messages.
summary: Personal UX standard for Joseph's own projects covering CLI/terminal UX, web/app UI patterns, a WCAG 2.1 AA accessibility baseline, and API/developer UX; flags violations as named areas of concern (rather than silently rewriting) since UX issues often trade off against effort, and cross-references brand-personal for UI copy and error-message wording -- applies only to personal projects, not NewRocket or other org work.
---

# Personal UX Standard

This is a personal standard, not a framework pulled from an external
source — set the same way a company would set its own UX guidelines.
Apply it only to personal projects. Where UI copy or error-message
wording is involved, apply the brand-personal skill's voice/tone section (1)
alongside this one rather than duplicating it here.

## 1. CLI/terminal UX
- **Flags** — kebab-case, with a short form only for genuinely
  high-frequency flags (`-v`/`--verbose`), never invented just to save
  keystrokes. Every flag needs `--help` text.
- **Output** — human-readable by default; a `--json` (or similar)
  machine-readable mode when the tool's output is likely to be piped or
  scripted. Don't mix the two in one default output.
- **Errors** — go to stderr, not stdout; exit non-zero on failure. Follow
  the brand-personal skill's error-message ordering (what went wrong, then what
  to do about it).
- **Progress/verbosity** — silent on success by default for scriptable
  tools; a `--verbose`/`--quiet` pair rather than a single fixed
  verbosity level.
- **Idempotency and destructive actions** — a command that deletes or
  overwrites needs a confirmation step or a `--force`/`--yes` flag to
  skip it, not silent execution by default.

## 2. Web/app UI patterns
- **Consistency over novelty** — reuse the same component and
  interaction pattern for the same kind of action across a project
  (one modal pattern, one form-validation pattern, one loading-state
  pattern), rather than inventing a new pattern per screen.
- **Forms** — validate inline, close to the field, not only on submit;
  show what's wrong and how to fix it, not just that something's
  invalid.
- **Loading and empty states** — every view that can be loading, empty,
  or errored needs an explicit state for each, not just the
  happy-path/populated state.
- **Navigation** — the current location should always be visible
  (active nav state, breadcrumb, or page title) — don't leave the user
  guessing where they are.

## 3. Accessibility baseline — WCAG 2.1 AA
Treat this as a minimum for anything with a UI, not an optional pass at
the end:
- **Contrast** — 4.5:1 for normal text, 3:1 for large text (18pt+/14pt+
  bold) and UI components/graphical objects.
- **Keyboard navigation** — every interactive element reachable and
  operable by keyboard alone, with a visible focus state; no
  keyboard traps.
- **Semantic HTML first** — use the native element for the job (`button`,
  `nav`, `label`, heading levels in order) before reaching for ARIA;
  ARIA fills gaps native HTML can't cover, it doesn't replace it.
- **Alt text** — every meaningful image needs it; decorative images get
  an empty `alt=""`, not a missing attribute.
- **Don't rely on color alone** — pair color with text, icon, or pattern
  for any state that matters (error, success, required field).

## 4. API/developer UX
Applies to any interface another developer (including future-you)
consumes — a public API, a library, an internal service boundary:
- **Predictable naming and shape** — consistent verb/noun conventions
  across endpoints or functions; don't mix styles (`getUser` next to
  `fetch_order`) within the same surface.
- **Errors carry enough to act on** — a machine-readable error code plus
  a human-readable message, not just an HTTP status or a generic
  exception type.
- **Sensible defaults, escape hatches available** — the common case
  should need minimal configuration; advanced options exist but don't
  crowd the default path.
- **Document by example** — every public function/endpoint gets at least
  one runnable usage example, not just a parameter list.
- **Versioning is explicit** — a breaking change to a public
  interface is called out (changelog, major version bump), never shipped
  silently.

## How to apply this skill
1. Identify the surface — CLI, web/app UI, or API/library — and apply
   the matching section (1, 2, or 4); apply section 3 to any surface
   with a visual UI, on top of whichever other section applies.
2. For UI copy or error-message wording specifically, apply the brand-personal
   skill's voice/tone section alongside this one.
3. Flag violations as explicit "areas of concern," naming which section
   and rule they violate, rather than rewriting silently — UX issues
   often trade off against effort, so let the user decide.
4. Only apply this skill to Joseph's personal projects — if the project
   is for NewRocket or another org, say so and stop rather than applying
   a personal standard to org work.

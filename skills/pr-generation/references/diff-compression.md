# Diff Compression Reference

Algorithm for compressing large git diffs before they are passed to LLM calls in the
`pr-generation` skill. This process is entirely deterministic — no LLM involvement.
Apply all steps in order; Step 6 (preserve logic-change hunks) overrides steps 2–4.

---

## Step 1 — Drop Whitespace-Only Hunks

A hunk is whitespace-only when **every** `+` and `-` line in the hunk body (excluding the
`@@` header line) contains only spaces, tabs, or is completely blank.

Drop the entire hunk. Do not modify surrounding context lines or the file header.

---

## Step 2 — Summarise Generated Files

Detect generated files by checking **either** of:

**Marker in the first 5 lines of the file:**
- `// Code generated`
- `// DO NOT EDIT`
- `# DO NOT EDIT`
- `# Code generated`
- `/* eslint-disable */` (appearing alone on a line)
- `/* tslint:disable */`

**Filename pattern (exact match or glob):**
- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`
- `*.min.js`
- `*.min.css`
- `*.pb.go`
- `*.generated.ts`
- `*.generated.graphql`

**Action:** Replace the entire file diff (from `diff --git` header to the last hunk) with a
single summary line:

```
[Generated file: <filename> — +<N>/-<M> lines — omitted from LLM context]
```

Where `<N>` and `<M>` are the raw added and removed line counts before omission.

---

## Step 3 — Summarise Vendor and Dependency Directories

Detect paths inside these directories (prefix match):
- `node_modules/`
- `vendor/`
- `.venv/`
- `venv/`
- `dist/`
- `build/`
- `.next/`
- `__pycache__/`

**Action:** Replace all hunks from the entire directory with one summary line per directory:

```
[Vendor/generated directory: <dir>/ — +<N>/-<M> lines — omitted from LLM context]
```

---

## Step 4 — Truncate Large Single-File Diffs

After applying steps 1–3, if a single file's remaining diff exceeds **300 lines** of
`+`/`-` content:

1. Keep the first **150** `+`/`-` lines
2. Insert: `[... <N> lines omitted — file too large for full context ...]`
3. Keep the last **50** `+`/`-` lines

Context lines (no `+`/`-` prefix) do not count toward the 300-line threshold.

---

## Step 5 — Count Non-Boilerplate Lines and Set Size Warning

After applying steps 1–4, count all remaining `+` and `-` lines across the entire
compressed diff. Exclude:
- `@@` hunk headers
- Context lines (lines without `+`/`-` prefix)
- Summary placeholder lines from steps 2–3

If the count exceeds **400** → set:

```
size_warning = "This PR changes {count} non-boilerplate lines (threshold: 400).
Consider splitting into smaller, focused PRs.
(Source: Google eng-practices, Small CLs — smaller PRs are reviewed faster,
more thoroughly, and are less likely to introduce bugs.)"
```

If count ≤ 400 → `size_warning = null`.

---

## Step 6 — Preserve Logic-Change Hunks in Full (Overrides Steps 2–4)

The following hunk content is **never** compressed, truncated, or omitted. If a hunk
contains any of these, it is kept in full even if the file would otherwise be summarised
or truncated:

- **Function and method bodies** — any hunk where a `+` or `-` line is inside a function,
  method, or closure body (heuristic: indented code following a function signature line)
- **Class definitions** — lines containing `class `, `struct `, `interface ` (as declarations)
- **Configuration values** — files with extensions `.env`, `.yaml`, `.yml`, `.toml`, `.ini`,
  and `.json` files that are **not** lock files
- **Schema changes** — files with extensions `.sql`, `.prisma`, `.graphql`, and `openapi.yaml`
  / `openapi.json`
- **Test assertions** — lines containing `assert`, `expect(`, `assertEqual`, `assertTrue`,
  `assertFalse`, `assertRaises`, `it(`, `describe(`, `test(` (common across Python, JS, Go)

When a logic-change hunk falls inside a file that would be summarised (step 2 or 3), extract
and preserve those hunks; summarise the remainder of the file.

---

## Compression Order Summary

```
For each file in the diff:
  1. Is it in a vendor/dependency directory?  →  summarise entire directory (Step 3)
  2. Is it a generated file?                  →  summarise entire file (Step 2)
  3. Does it have whitespace-only hunks?      →  drop those hunks (Step 1)
  4. Is the remaining diff > 300 lines?       →  truncate (Step 4)
  (Step 6 overrides steps 2–4 for logic-change hunks in all cases)

After processing all files:
  5. Count non-boilerplate +/- lines          →  set size_warning if > 400 (Step 5)
```

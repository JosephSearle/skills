# Validation Rules Reference

Machine-readable rules for the deterministic validator in Step 7 of the `pr-generation` skill.
All rules are checked against `filled_sections` (the map of `## section_name → content` produced
by the LLM fill step). Rules are evaluated in ID order. Failed rules accumulate into
`validation_errors`; the retry loop in Step 7 injects them back into the fill prompt.

---

## Rules Table

| Rule ID | Section checked | Condition that must be true | Error message if false |
|---|---|---|---|
| V001 | Summary | Non-empty AND contains ≥ 2 sentences (detected by ≥ 1 sentence-ending punctuation (`.`, `?`, `!`) followed by a capital letter or line break, after the first sentence) | "Summary is missing or too brief — must answer what and why in ≥ 2 sentences." |
| V002 | Linked Issue | Contains `Fixes #`, `Closes #`, `Refs #`, `fixes #`, `closes #`, or a URL matching `linear.app`, `jira`, `atlassian.net`, or `github.com/.*/issues/\d+` | "No linked issue found. Add `Fixes #<number>` or a ticket URL." |
| V003 | Test Plan | Contains ≥ 1 line matching the pattern `^\s*\d+[\.\)]` (a numbered step) | "Test Plan must contain at least one numbered step a reviewer can execute." |
| V004 | Breaking Change | **Only triggered when:** the compressed diff contains a removed or renamed function/method/type signature (see detection heuristic below). When triggered: the Breaking Change section must be non-empty and must not consist solely of `<!-- not applicable -->` or an HTML comment | "Breaking change detected in diff but the Breaking Change section is empty or marked not-applicable." |
| V005 | Reviewer Checklist | Contains ≥ 3 lines matching `- \[ \]` (unchecked task list items) | "Reviewer Checklist must contain ≥ 3 unchecked items." |
| V006 | AI Disclosure | The assembled `pr_body` contains the string `Co-Authored-By: Claude` | "AI assistance footer missing — it will be appended automatically in the Assembly step." |
| V007 | Size Warning | **Only triggered when:** `size_warning` is set (non-null). When triggered: `pr_body` must contain the size warning banner text (the `> ⚠️ **Large PR warning:**` block) | "Size warning was set but is absent from the PR body." |

---

## V004 Breaking-Change Detection Heuristic

Scan the **compressed diff** (not the raw diff) for `-` lines (removed lines) that match any
of these patterns. If any match → V004 is active for this validation pass.

**Go:**
- `-func ` at the start of a non-indented line (exported function removed)
- `-type ` followed by `interface` or `struct` (type declaration removed)

**Python:**
- `-def ` at zero or one level of indentation (module-level or class method removed)
- `-class ` at zero indentation

**TypeScript / JavaScript:**
- `-export function `, `-export const `, `-export class `, `-export default `
- `-export interface `, `-export type ` (exported type removed)
- `-  ` followed by a method name and `(` inside a class body (class method removed)

**Java / Kotlin / C#:**
- `-public `, `-protected ` followed by a return type and method name with `(`
- `-interface ` at low indentation

**General (language-agnostic):**
- Any `-` line containing `BREAKING CHANGE` or `BREAKING-CHANGE` (explicit annotation)

**Threshold:** At least **one** matching `-` line is sufficient to activate V004.

---

## Retry Behaviour

- Maximum **2 retries** before escalating to the human gate.
- On each retry, inject all current `validation_errors` as a comment block prepended to the
  template sections (see `references/prompt-templates.md` §3 for the exact format).
- `retry_count` increments by 1 each time Step 6 is re-entered due to validation failure.
- After 2 retries, proceed to assembly regardless — surface unresolved errors at the human gate.

---

## Rule Priority Notes

- **V001, V002, V003, V005** — always active, checked on every validation pass.
- **V004** — only active when the diff contains signature removals. If the diff scan is
  inconclusive (e.g. minified or binary diff), skip V004 and note "V004 skipped — diff not
  parseable for signature detection" in `validation_errors`.
- **V006** — informational; the assembly step will append the footer automatically, so this
  error does not count toward the retry limit.
- **V007** — only active when `size_warning` is set; the assembly step adds the banner, so
  this should only fire on the first validation pass before assembly.

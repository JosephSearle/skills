# Prompt Templates Reference

Exact system and user prompts for every LLM call made by the `pr-generation` skill.
All calls use `claude-sonnet-4-20250514`, temperature 0, max_tokens 4096.

---

## §1 — fill_template: System Prompt

Use this as the `system` parameter for the fill_template LLM call.

```
You are a precise technical writer filling a pull request description template.

Your task is to populate each ## section of the template using ONLY the information
present in the provided inputs (compressed git diff, commit messages, linked ticket body,
CONTRIBUTING.md, and prior PR examples).

Rules you must follow without exception:

1. EVIDENCE ONLY — If the diff, commits, or ticket do not support a claim, write
   <!-- not applicable --> in that section rather than guessing or inventing content.
   Never fabricate test steps, benchmark numbers, or issue references.

2. CITE YOUR SOURCES — For every specific code claim (e.g. "the function signature
   changed", "the config key was renamed"), cite the file path and line range from the
   diff: e.g. "src/auth/middleware.go:42–58".

3. IMPERATIVE MOOD FOR SUMMARY — The first sentence of the Summary section must be in
   imperative mood: "Add X", "Fix Y", "Refactor Z" — not "Added X", "This PR adds X",
   or "We added X".

4. STRUCTURED OUTPUT — Respond using the fill_template_sections tool. The tool input
   must be a JSON object with one key per ## section heading in the template (use the
   heading text verbatim as the key, without the ## prefix). Include every section —
   do not omit any heading from the template.

5. CONFIDENCE — Include a "confidence_test_plan" key in your tool call with value
   "low", "medium", or "high":
   - "high": the diff includes test file changes and the Test Plan can reference them directly
   - "medium": the diff includes enough code context to write plausible test steps
   - "low": the diff provides little or no basis for a concrete Test Plan

6. DETERMINISM — Produce the same output on repeated calls with the same inputs.
   Do not add creative variation or stylistic flourishes.

7. SECTION DISCIPLINE — Do not add new ## headings that are not in the template.
   Do not merge or rename template sections. Fill each section independently.
```

---

## §2 — fill_template: User Prompt Template

Assemble this user prompt by substituting all `{placeholders}`. Omit the
`{TICKET_BLOCK}`, `{FEW_SHOT_BLOCK}`, and `{CONTRIBUTING_BLOCK}` sections entirely
(including their headers) when the corresponding data is unavailable.

```
## Inputs

### Git diff (compressed)

{compressed_diff}

### Commit messages

{commit_messages}

{TICKET_BLOCK_START}
### Linked ticket

{ticket_body}
{TICKET_BLOCK_END}

{FEW_SHOT_BLOCK_START}
### Prior merged PR examples

These are example PR descriptions from this repository. Use them for style and
formatting reference only — do not copy their content into the new PR description.

{few_shot_examples}
{FEW_SHOT_BLOCK_END}

{CONTRIBUTING_BLOCK_START}
### CONTRIBUTING.md

{contributing_md}
{CONTRIBUTING_BLOCK_END}

---

## Template sections to fill

Fill every section below. Use the section heading text (without ##) as the key in
your fill_template_sections tool call.

{template_sections}
```

**Placeholder substitution rules:**

| Placeholder | Source | When to omit the block |
|---|---|---|
| `{compressed_diff}` | Output of Step 5 (diff compression) | Never — required |
| `{commit_messages}` | `git log --oneline <base>...HEAD` | Never — required |
| `{ticket_body}` | Fetched from Jira/Linear/GitHub Issues | Omit `{TICKET_BLOCK}` if `linked_ticket` is null |
| `{few_shot_examples}` | 2 prior merged PR bodies from GitHub API | Omit `{FEW_SHOT_BLOCK}` if GitHub API unavailable |
| `{contributing_md}` | CONTRIBUTING.md from repo root | Omit `{CONTRIBUTING_BLOCK}` if file not present |
| `{template_sections}` | `##` headings extracted from `template_content` | Never — required |

**Template sections format:** Extract every `##` heading from `template_content` and list
them as:

```
## Summary

## Linked Issue

## Type of Change

[... all headings in template order ...]
```

---

## §3 — Validation Error Re-injection (Retry Prompt)

When the validator returns errors and `retry_count < 2`, prepend this block to
`{template_sections}` in the user prompt before re-running the fill call.

```
<!-- VALIDATION ERRORS FROM PREVIOUS ATTEMPT

The following sections did not meet the required standards. Fix them in your next response.
Do not change sections that were not listed here.

{validation_errors_list}

-->
```

**Formatting `{validation_errors_list}`:** One error per line, using the exact error
message strings from `references/validation-rules.md`. Example:

```
- [V001] Summary is missing or too brief — must answer what and why in ≥ 2 sentences.
- [V003] Test Plan must contain at least one numbered step a reviewer can execute.
```

---

## §4 — pr_title Generation

Use this as a standalone LLM call (same model, temperature 0) after the fill step
produces the Summary section content.

**System prompt:**

```
Generate a pull request title in imperative mood, maximum 72 characters, derived from
the first sentence of the provided Summary section.

Rules:
- Imperative mood: "Add X", "Fix Y", "Refactor Z" — not "Added", "This PR", "We"
- Maximum 72 characters including spaces
- No trailing punctuation
- No quotes around the title
- Output only the title string — nothing else
```

**User prompt:**

```
Summary first sentence: {summary_first_sentence}
```

**Extracting `{summary_first_sentence}`:** Take the content of the Summary section from
`filled_sections["Summary"]`. Split on the first sentence-ending punctuation (`.`, `?`, `!`)
followed by a space or newline. Use everything up to and including that punctuation mark.
If the Summary contains no sentence-ending punctuation, use the first line.

---

## §5 — Tool Schema: fill_template_sections

Define this tool in the API call's `tools` array when calling the fill_template LLM.

```json
{
  "name": "fill_template_sections",
  "description": "Submit the filled PR template sections as a structured JSON object.",
  "input_schema": {
    "type": "object",
    "properties": {
      "sections": {
        "type": "object",
        "description": "Map of section heading text (without ## prefix) to filled content string.",
        "additionalProperties": {
          "type": "string"
        }
      },
      "confidence_test_plan": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "description": "Confidence that the Test Plan section is accurate and complete given the diff."
      }
    },
    "required": ["sections", "confidence_test_plan"]
  }
}
```

**Calling the API:** Use `tool_choice: { "type": "tool", "name": "fill_template_sections" }`
to force a structured response rather than free-form text. Extract `input.sections` and
`input.confidence_test_plan` from the tool_use content block in the response.

---
name: pr-generation
description: >
  Generate a high-quality, fully-populated GitHub pull request description and open the PR,
  or update an existing draft PR. Detects and uses an existing PR template when present;
  generates a project-appropriate template when none exists, inferring the project type from
  the repository structure (Web/Frontend, Backend/API, Full-stack, Data/ML/AI, MCP/AI-agent).
  Compresses the diff, fills the template via a structured Claude API call, runs deterministic
  validation, and presents a mandatory human review gate before posting. Triggers on: "create
  a PR", "open a pull request", "generate a PR description", "draft a PR", "write a PR for
  this branch", "make a pull request", "create a pull request", "update my draft PR",
  "fill in my PR template", "open a GitHub PR", or any instruction to create, draft, open,
  or update a pull request or PR description.
version: 1.0.0
---

# PR Generation Skill

A skill for creating and updating GitHub pull requests with high-quality, fully-populated
descriptions. Grounded in Google `eng-practices`, Meta/React Native contributing docs,
GitHub official documentation, and the Kubernetes contributor guide.

---

## Core Philosophy

A pull request description's job is to convey what changed and why clearly enough that a
reviewer can understand, validate, and safely approve the change. A reviewer who reads only
the PR description should know what to look for in the diff.

The human always merges. This skill creates and populates — it never merges, force-pushes,
or takes irreversible actions without explicit instruction.

Three invariants that are never violated:
- Never post a PR without human approval at the review gate.
- Never invent content not supported by the diff — use `<!-- not applicable -->` instead.
- Never omit the AI-assistance disclosure footer.

---

## Step 1 — Mode Detection

```
Is there an existing open draft PR for the current branch?
  (Check: gh pr list --head <branch> --state open, or list_pull_requests MCP tool)
  └─ YES → MODE = "update-draft"
            Record the existing PR number and current body
            Identify which sections were manually edited (compare against the
            template skeleton — any section with content not matching a template
            placeholder is considered manually edited)
            Preserve manually edited sections; only update placeholder sections
  └─ NO  →
      Was a specific template name passed in the request?
      (e.g. "use the security template", "--template=feature.md")
        └─ YES → Look up .github/PULL_REQUEST_TEMPLATE/<name>.md
                  └─ Found → use this template; proceed to Step 3
                  └─ Not found → warn: "Template '<name>' not found in
                                  .github/PULL_REQUEST_TEMPLATE/. Falling through
                                  to auto-detect."
                                  Proceed to Step 4 (template resolution)
        └─ NO  → MODE = "create"
                  Proceed to Step 2
```

**Hard rules for mode detection:**
- Never overwrite a manually edited PR body without explicit author confirmation.
- If `.github/PULL_REQUEST_TEMPLATE/` exists with multiple files and no template was
  specified → do not auto-select. Surface the list to the author at the human gate (Step 9)
  and ask for a selection before proceeding.

---

## Step 2 — Tooling Resolution

```
Is the GitHub MCP server available in this harness?
  └─ YES → Use MCP tools for all GitHub API operations (preferred)
  └─ NO  → Use `gh` CLI (fallback)
```

| Operation | MCP tool | `gh` / `git` CLI fallback |
|---|---|---|
| Get current branch | `git` local | `git branch --show-current` |
| Get diff | `git` local | `git diff <base>...HEAD` |
| Get commit log | `git` local | `git log --oneline <base>...HEAD` |
| Check for open draft PR | `list_pull_requests` | `gh pr list --head <branch> --state open` |
| Fetch prior merged PRs | `list_pull_requests` (state=closed) | `gh pr list --state merged --limit 2 --json body` |
| Create PR | `create_pull_request` | `gh pr create --title "…" --body "…" --base <base> --draft` |
| Update draft PR | `update_pull_request` | `gh pr edit <number> --title "…" --body "…"` |

---

## Step 3 — Context Gathering

Collect all of the following before generating any content. Record each item; do not ask
the author for anything that can be detected automatically.

**1. Branch name and base branch**
- Current branch: `git branch --show-current`
- Base branch: default `main`; detect from repo default branch if different
- Extract ticket pattern from branch name using regex:
  `(PROJ|LINEAR|GH|ISSUE|LIN)-\d+` or `issue/\d+` or `fix/\d+` or `feature/\d+`

**2. Raw git diff**
- `git diff <base>...HEAD` — full diff, before compression
- If the diff is empty (branch has no commits ahead of base): stop and inform the author
  "No changes detected between this branch and <base>. Nothing to PR."

**3. Commit messages**
- `git log --oneline <base>...HEAD`

**4. Linked ticket body** (optional)
- If a ticket pattern was found in the branch name, attempt to fetch the ticket body:
  - GitHub issue: `GET /repos/{owner}/{repo}/issues/{number}` → extract `body`
  - Linear: GraphQL query for issue by ID → extract `description`
  - Jira: REST API `GET /rest/api/3/issue/{PROJ-123}` → extract `fields.description`
- If the API is unavailable or the ticket is not found: `linked_ticket = null` (continue)

**5. CONTRIBUTING.md**
- Check for `CONTRIBUTING.md` at the repo root
- If present: read it in full — it supplies project-specific "why" context
- If absent: skip

**6. Two prior merged PR bodies (few-shot examples)**
- Fetch via: `GET /repos/{owner}/{repo}/pulls?state=closed&sort=updated&per_page=2`
  or `gh pr list --state merged --limit 2 --json body`
- If unavailable: skip (few-shot is optional)

**7. Dependency manifests** (for project-type detection in Step 4)
- Check for: `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`,
  `pom.xml`, `build.gradle`, `langgraph.json`, `mcp.json`
- Record which files exist and their content (for detection only; do not include full
  content in LLM prompts)

---

## Step 4 — Template Resolution

```
Does .github/pull_request_template.md exist?
  └─ YES → template_source = "existing"
            Load file content as template_content
            Skip to Step 5

Does .github/PULL_REQUEST_TEMPLATE/ directory exist?
  └─ YES → template_source = "multi"
            List all .md files in the directory
            Was a specific template requested in Step 1?
              └─ YES → Load that file; proceed to Step 5
              └─ NO  → Surface the file list to the author at the human gate (Step 9)
                        and wait for their selection before proceeding
                        (Do not auto-select — see Hard Rules)

Neither exists?
  └─ template_source = "generated"
    Load references/project-types.md
    Run the detection decision tree (reproduced below for convenience;
    full detail and supplemental block content in references/project-types.md):
```

```
Project-type detection (first match wins):

Is langgraph.json present? OR does package.json declare @langchain/langgraph?
OR does pyproject.toml/requirements.txt declare langgraph, langchain, crewai,
autogen, pydantic-ai, or openai-agents?
  └─ YES → project_type = "MCP / AI-agent"

Does pyproject.toml or requirements.txt declare torch, tensorflow, sklearn,
transformers, xgboost, mlflow, or wandb?
OR are there *.ipynb files at root or in notebooks/?
  └─ YES → project_type = "Data / ML / AI"

Does package.json declare BOTH frontend deps (react, vue, next, nuxt, svelte,
angular, solid) AND backend deps (express, fastify, nest, koa, hapi)?
  └─ YES → project_type = "Full-stack"

Does package.json declare frontend-only deps (react, vue, next, nuxt, svelte, angular)?
OR are there *.tsx / *.jsx files?
  └─ YES → project_type = "Web / Frontend"

Are there *.go files? OR FastAPI/Django/Flask/Spring/NestJS/Express/Gin/Echo deps?
OR openapi.yaml / schema.graphql?
  └─ YES → project_type = "Backend / API"

None of the above?
  └─ project_type = "Universal fallback"
```

```
After detecting project_type:
  Load references/universal-template.md
  Assemble template_content:
    1. Universal base (all 9 sections from references/universal-template.md)
    2. If project_type ≠ "Universal fallback": append the supplemental block
       for the detected type from references/project-types.md
  Write assembled template to .github/pull_request_template.md as an UNTRACKED FILE
  (do not stage, do not commit)
```

---

## Step 5 — Diff Compression

Load `references/diff-compression.md` and apply the 6-step algorithm in full:

1. **Drop whitespace-only hunks** — remove hunks where every `+`/`-` line is blank or whitespace
2. **Summarise generated files** — replace with `[Generated file: <name> — +N/-M lines — omitted]`
3. **Summarise vendor directories** — replace `node_modules/`, `vendor/`, `.venv/`, etc.
4. **Truncate large single-file diffs** — keep first 150 + last 50 lines for files > 300 lines
5. **Count non-boilerplate lines** — set `size_warning` if count > 400
6. **Preserve logic-change hunks** — never omit function bodies, schema changes, test assertions

After compression: `compressed_diff` is ready for the LLM fill step.

**Size warning format** (prepended to `pr_body` in Step 8 if set):
```
> ⚠️ **Large PR warning:** This PR changes {count} non-boilerplate lines (threshold: 400).
> Consider splitting into smaller, focused PRs for faster, higher-quality review.
> (Source: Google eng-practices, *Small CLs*)
```

---

## Step 6 — LLM Template Fill

Load `references/prompt-templates.md` §1 (system prompt) and §2 (user prompt template).

**LLM call parameters:**
- Model: `claude-sonnet-4-20250514`
- Temperature: `0`
- Max tokens: `4096`
- Tool: `fill_template_sections` (schema in `references/prompt-templates.md` §5)
- Tool choice: `{ "type": "tool", "name": "fill_template_sections" }` (forced structured output)

**Assemble the user prompt** by substituting:
- `{compressed_diff}` — output of Step 5
- `{commit_messages}` — from Step 3
- `{ticket_body}` — from Step 3 (omit the entire `{TICKET_BLOCK}` if `linked_ticket` is null)
- `{template_sections}` — all `##` headings extracted from `template_content`, in order
- `{few_shot_examples}` — from Step 3 (omit `{FEW_SHOT_BLOCK}` if unavailable)
- `{contributing_md}` — from Step 3 (omit `{CONTRIBUTING_BLOCK}` if file not present)

**Outputs from the tool call:**
- `filled_sections` — `{ "<section heading>": "<content>" }` map
- `confidence_test_plan` — `"low"` | `"medium"` | `"high"`

---

## Step 7 — Validation

Load `references/validation-rules.md`. Check all 7 rules against `filled_sections`.
Rules V004 and V007 are conditional — check only when their trigger condition is met.

```
validation_errors = [] (start empty)
retry_count = 0 (start at 0)

Run all applicable rules (V001–V007):
  Each failed rule → append its error message to validation_errors

validation_errors empty?
  └─ YES → proceed to Step 8

validation_errors non-empty AND retry_count < 2?
  └─ Inject errors into prompt (references/prompt-templates.md §3):
      Prepend error block to {template_sections} in the user prompt
     Increment retry_count by 1
     Re-run Step 6
     Re-run Step 7 validation

retry_count >= 2 AND validation_errors still non-empty?
  └─ Proceed to Step 8
     Surface all unresolved validation_errors prominently at the human gate
     Do not block — let the human resolve remaining issues
```

Note: V006 (AI disclosure) does not count toward the retry limit — the assembly step
appends the footer automatically.

---

## Step 8 — Assembly

Reconstruct `pr_body` from `filled_sections`:

1. **Reassemble sections** in the order they appear in `template_content`:
   For each `##` heading in the template, insert `## <heading>\n\n<filled_sections[heading]>\n`

2. **Generate `pr_title`** using the sub-prompt in `references/prompt-templates.md` §4:
   - Extract the first sentence of `filled_sections["Summary"]`
   - Send to Claude (same model, temperature 0) with the title generation prompt
   - Result: imperative mood, ≤ 72 characters

3. **Prepend size warning banner** if `size_warning` is set:
   ```
   > ⚠️ **Large PR warning:** This PR changes {count} non-boilerplate lines (threshold: 400).
   > Consider splitting into smaller, focused PRs for faster, higher-quality review.
   > (Source: Google eng-practices, *Small CLs*)

   ---
   ```

4. **Append AI disclosure footer**:
   ```
   ---
   *Co-Authored-By: Claude <noreply@anthropic.com>*
   ```

`pr_body` is now fully assembled.

---

## Step 9 — Human Gate (mandatory, non-skippable)

Pause and present the following to the author for review and approval.

**Always display:**
- `pr_title` — editable
- `pr_body` — full text, editable

**Display prominently if set:**
- `validation_errors` — list each unresolved error with its rule ID and the suggested fix
- `size_warning` — display as a banner above the PR body preview
- `confidence_test_plan = "low"` — display: "⚠️ Test Plan confidence is LOW — the diff
  did not provide enough evidence to write concrete test steps. Please review and strengthen
  the Test Plan section before approving."

**Display as informational notes if applicable:**
- `template_source = "generated"` — "A new PR template was written to
  `.github/pull_request_template.md` (untracked). Review and commit it separately if you
  want future PRs to use this template."
- `template_source = "multi"` (if waiting on selection) — "Multiple PR templates found:
  [list]. Which template should be used for this PR?"

**Author actions:**
- **Approve** — confirms `pr_title` and `pr_body` are correct; proceed to Step 10
- **Edit** — author modifies `pr_title` and/or `pr_body` inline; re-present for confirmation
- **Cancel** — stop; output `{ "cancelled": true }`; do not create or update the PR

**Hard rule: This gate is never skippable.** No flag, argument, or automation bypasses it.
Every PR must be reviewed by the author before posting.

---

## Step 10 — PR Creation

```
MODE = "update-draft"?
  └─ YES → Update the existing draft PR:
            MCP: update_pull_request({ number: existing_pr_number,
                                       title: pr_title, body: pr_body })
            CLI: gh pr edit <existing_pr_number> --title "<pr_title>" --body "<pr_body>"

MODE = "create"?
  └─ YES → Create a new draft PR:
            MCP: create_pull_request({ title: pr_title, body: pr_body,
                                       base: base_branch, draft: true })
            CLI: gh pr create \
                   --title "<pr_title>" \
                   --body "<pr_body>" \
                   --base <base_branch> \
                   --draft
```

Parse the returned PR URL from the response and record it as `pr_url`.

**Output to the author:**

```
✓ PR created: <pr_url>

Summary:
  template_source:        <existing | generated | multi>
  project_type:           <detected type>
  size_warning:           <set | not set>
  confidence_test_plan:   <low | medium | high>
```

---

## Hard Rules

- **Never post a PR without human approval at the gate (Step 9).** No flag bypasses it.
- **Never invent a Test Plan.** If the diff provides no test evidence, write
  `<!-- not applicable -->` and set `confidence_test_plan = "low"`.
- **Never suppress the size warning.** If `size_warning` is set, it must appear in `pr_body`
  and be surfaced at the human gate.
- **Never skip the AI-assistance disclosure footer.** `Co-Authored-By: Claude` is always
  appended in Step 8, regardless of what the LLM produced.
- **Never overwrite a manually edited PR body without explicit confirmation.** In
  update-draft mode, preserve all manually edited sections.
- **Never produce a PR template that omits Summary, Linked Issue, Test Plan, or Reviewer
  Checklist sections.** These are always required in any generated or existing template.
- **Never auto-commit the generated `.github/pull_request_template.md`.** Write it as an
  untracked file only — the author decides whether to commit it.
- **Never auto-select from a multi-template directory.** Always surface the file list and
  ask the author to choose.

---

## Reference Files

| File | Purpose |
|---|---|
| `references/universal-template.md` | Master PR template: universal base (9 sections) + all 5 supplemental blocks; assembly instructions for the skill |
| `references/project-types.md` | Detection decision tree (first-match, 6 types) + full supplemental block content for each type |
| `references/prompt-templates.md` | Exact system prompt, user prompt template, validation error re-injection format, title generation sub-prompt, and `fill_template_sections` tool schema |
| `references/validation-rules.md` | 7 machine-readable rules (V001–V007) with conditions, error messages, and retry behaviour |
| `references/diff-compression.md` | 6-step deterministic compression algorithm; 400-line threshold; size warning logic |
| `references/anti-patterns.md` | 8 documented anti-patterns with detection heuristics, primary source citations, and skill actions |

---

## Out of Scope

- Automatic PR merging — the skill creates/updates only; merging is always a human action
- Reviewing other people's PRs — that is the `code-review` skill
- GitLab, Bitbucket, or Azure DevOps — GitHub only in v1
- Commit-message generation — that is a separate concern
- CI/CD pipeline triggering — the PR is posted; CI responds naturally via GitHub webhooks
- Auto-selecting from a multi-template directory — always surfaces the list for author choice
- Executing the Test Plan — the skill describes test steps; it does not run them

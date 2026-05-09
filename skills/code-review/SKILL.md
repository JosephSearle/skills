---
name: code-review
description: >
  Perform a structured code review on a GitHub pull request. Analyses the diff for correctness,
  security, style, and language-specific issues, then posts inline and general comments using the
  GitHub MCP server or gh CLI. Supports Golang, TypeScript, and Python via language reference files.
  Triggers on: "review this PR", "review this pull request", "check this diff", "look over my changes",
  or any instruction to assess code quality on a branch or PR.
---

# Code Review Skill

A skill for performing structured, actionable code reviews on GitHub pull requests. Covers severity
classification, comment standards, inline and general comment posting, and approval decisions —
grounded in Google style guides for Golang, TypeScript, and Python.

---

## Core Philosophy

A code review has one job: help the author make the code better before it merges. Every comment
must answer: **what is the problem, why does it matter, and what should be done instead.**

A review that only identifies problems without suggesting resolutions is incomplete. A review that
approves code with unresolved blockers has failed its purpose.

---

## Step 1 — Tooling Resolution

Determine which tools are available for posting comments and submitting the review:

```
Is the GitHub MCP server available in this harness?
  └─ YES → Use MCP tools for all PR comment and review submission operations
  └─ NO  → Use `gh` CLI as fallback
```

**Tool-to-operation mapping:**

| Operation | MCP Tool | Fallback (`gh` / API) |
|-----------|----------|-----------------------|
| Get PR diff | `get_pull_request` / `get_pull_request_diff` | `gh pr diff <number>` |
| List PR files | `get_pull_request_files` | `gh pr diff --name-only <number>` |
| Post inline comment | `add_pull_request_review_comment` | `gh api repos/{owner}/{repo}/pulls/{number}/comments` |
| Submit review | `create_pull_request_review` | `gh pr review <number> --approve\|--request-changes\|--comment` |
| Post general comment | `add_issue_comment` | `gh pr comment <number> --body "..."` |

---

## Step 2 — Determine Review Scope

Before reading the diff, establish what kind of review is needed:

```
Was a specific review focus requested (e.g. "security review", "check types only")?
  └─ YES → Limit review to that category; note the limited scope in the summary comment
  └─ NO  → Full review across all categories

Identify the primary language(s) in the diff:
  └─ .go files        → load references/golang.md
  └─ .ts / .tsx files → load references/typescript.md
  └─ .py files        → load references/python.md
  └─ .tf / .tfvars    → load references/terraform.md
  └─ Mixed            → load all relevant language references

Always load references/security.md on every PR regardless of language.

Does the diff contain LLM API calls, agent/graph nodes, prompt construction, tool definitions,
RAG pipelines, vector store interactions, or model loading?
  └─ YES → also load references/llm-security.md
```

---

## Step 3 — Severity Classification

Every finding MUST be assigned one of four severity levels. Severity determines both the comment
prefix and the final approval decision.

| Severity | Prefix | Meaning |
|----------|--------|---------|
| Blocker | `[blocker]` | MUST be fixed before merge. Correctness bug, security vulnerability, data loss risk, or broken contract |
| Major | `[major]` | Should be fixed before merge. Significant design issue, performance problem, or style violation that will cause future pain |
| Minor | `[minor]` | Worth fixing but does not block merge. Small style issue, missed optimisation, or incomplete implementation of a non-critical path |
| Nit | `[nit]` | Optional, take-it-or-leave-it. Purely stylistic preference with no correctness or maintenance impact |

**Approval gate:**
- Any `[blocker]` → **REQUEST_CHANGES**
- Any `[major]` (no blockers) → **REQUEST_CHANGES**
- Only `[minor]` / `[nit]` → **COMMENT** (approve with suggestions noted)
- No findings → **APPROVE**

---

## Step 4 — Review Process

Work through the diff systematically in this order:

1. **Read the PR description first** — understand the intent before reading code. If the description
   is missing or unclear, post a general `[major]` comment asking for it before proceeding.

2. **Apply security checks from `references/security.md`** — work through all 10 OWASP Top 10 categories plus the additional industry-standard checks. These apply to every PR regardless of language.

3. **Read changed files top-to-bottom** — apply the relevant language reference checks as you go.

4. **Check PR scope** — if the diff touches unrelated concerns (multiple features, mixed bug fixes),
   note this as a `[major]` on the PR level, not on a specific line.

5. **Collect all findings** before posting — do not post comments one by one as you find them.
   Submit the full review in a single operation.

---

## Step 5 — Comment Standards

### Inline comment format

```
[severity] <observation>

<Why this matters — one sentence on the risk or consequence.>

<Suggestion — what to do instead. Include a short code example if helpful.>
```

**Example:**
```
[blocker] Error return value is discarded here.

Discarding this error means failures will be silently swallowed, making this
code impossible to debug in production.

Always check the returned error:
  if err := doThing(); err != nil {
      return fmt.Errorf("doThing: %w", err)
  }
```

### Rules

- **Observation → Why → Suggestion** — never skip the suggestion. Flagging a problem without a resolution is unhelpful.
- **Critique the code, not the author** — "this function does X" not "you wrote X wrong"
- **Phrase uncertainty as a question** — "could this panic if the slice is empty?" not "this will panic"
- **Nits must be labelled** — always prefix with `[nit]` so authors can deprioritise without guessing
- **No drive-by style fixes** — only comment on code in the diff, not pre-existing issues outside the PR scope
- **Be concise** — one clear sentence per point. If you need more than three sentences, consider whether the issue is actually a blocker requiring a design discussion

### When to use inline vs general comments

| Use inline when | Use a general PR comment when |
|-----------------|-------------------------------|
| The issue is tied to a specific file and line | The issue spans multiple files or the whole PR |
| The suggestion can be applied at that location | The issue is about PR scope, description, or architecture |
| The finding is language-specific | The finding is a universal security or process concern |

---

## Step 6 — Posting Comments

### Collect all findings first

Before posting anything, compile a complete list of findings with their file, line, severity, and
comment text. Then post everything in a single review submission.

### Post inline comments

**MCP (preferred):**
```json
{
  "name": "add_pull_request_review_comment",
  "arguments": {
    "owner": "<owner>",
    "repo": "<repo>",
    "pullNumber": 124,
    "body": "[blocker] Error return value is discarded here.\n\nDiscarding this error means failures will be silently swallowed...\n\nAlways check: if err := doThing(); err != nil { ... }",
    "path": "internal/auth/session.go",
    "line": 42,
    "side": "RIGHT"
  }
}
```

**Fallback (`gh` API):**
```bash
gh api repos/<owner>/<repo>/pulls/124/comments \
  --method POST \
  --field body="[blocker] Error return value is discarded here..." \
  --field commit_id="<HEAD_SHA>" \
  --field path="internal/auth/session.go" \
  --field line=42 \
  --field side="RIGHT"
```

### Submit the review

After all inline comments are posted, submit the overall review verdict with a summary comment.

**MCP (preferred):**
```json
{
  "name": "create_pull_request_review",
  "arguments": {
    "owner": "<owner>",
    "repo": "<repo>",
    "pullNumber": 124,
    "event": "REQUEST_CHANGES",
    "body": "## Review Summary\n\n**Findings:** 1 blocker, 2 minor\n\n**Blockers must be resolved before merge.**\n\nSee inline comments for details."
  }
}
```

`event` must be one of: `APPROVE`, `REQUEST_CHANGES`, `COMMENT`

**Fallback (`gh` CLI):**
```bash
# Request changes
gh pr review 124 --request-changes --body "## Review Summary..."

# Approve
gh pr review 124 --approve --body "LGTM. One nit left inline."

# Comment only (no approval decision)
gh pr review 124 --comment --body "## Review Summary..."
```

### Review summary comment structure

```markdown
## Review Summary

**Language(s):** <Go / TypeScript / Python>
**Findings:** <N blocker(s), N major, N minor, N nit(s)>
**Verdict:** <APPROVE / REQUEST_CHANGES / COMMENT>

### Blockers
- <file>:<line> — <one-line description>

### Majors
- <file>:<line> — <one-line description>

### Notes
<Any architectural observations or positive callouts that don't fit inline.>
```

---

## Step 7 — Approval Decision

Apply the gate from Step 3 and submit with the appropriate `event` value:

```
Are there any [blocker] findings?
  └─ YES → event: REQUEST_CHANGES

Are there any [major] findings (no blockers)?
  └─ YES → event: REQUEST_CHANGES

Are findings only [minor] or [nit]?
  └─ YES → event: COMMENT (note findings but do not block merge)

No findings at all?
  └─ YES → event: APPROVE
```

Never submit `APPROVE` if any finding is unresolved. If approving with nits, state this explicitly
in the summary: "Approving — nit left inline, take it or leave it."

---

## Reference Files

- `references/security.md` — Full OWASP Top 10:2021 security checks plus industry-standard additions (secrets, IAM, PII, dependency safety) — load on every PR
- `references/llm-security.md` — OWASP LLM Top 10:2025, MITRE ATLAS, EU AI Act, and GDPR checks for LLM API calls, agent nodes, RAG pipelines, tool definitions, and model loading — load when the diff touches AI/LLM code
- `references/golang.md` — Go-specific checks grounded in the [Google Go Style Guide](https://google.github.io/styleguide/go/)
- `references/typescript.md` — TypeScript checks grounded in the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- `references/python.md` — Python checks grounded in the [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
- `references/terraform.md` — Terraform checks grounded in the [HashiCorp Terraform Style Guide](https://developer.hashicorp.com/terraform/language/style)

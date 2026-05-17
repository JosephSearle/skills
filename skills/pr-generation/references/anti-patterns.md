# Anti-Patterns Reference

Eight documented PR anti-patterns, their harms, detection heuristics, and the skill's
response. Grounded in: Google `eng-practices` (CC-BY 3.0), Meta/React Native contributing
docs, GitHub official documentation on pull requests, and the Kubernetes contributor guide.

---

## Summary Table

| # | Anti-pattern | Detection heuristic | Skill action |
|---|---|---|---|
| 1 | Empty PR body | `pr_body` length < 100 chars after fill | Block PR creation; re-enter fill step with error |
| 2 | Vague or single-sentence Summary | Summary < 2 sentences (V001) | V001 validation error → retry fill |
| 3 | No linked issue | No `Fixes #`, `Closes #`, or ticket URL (V002) | V002 validation error → retry fill |
| 4 | No Test Plan steps | Test Plan has no numbered step (V003) | `confidence_test_plan = "low"`; surface at human gate |
| 5 | Mega-PR (> 400 non-boilerplate lines) | `size_warning` is set | Prepend warning banner; surface at human gate (non-blocking) |
| 6 | Multiple unrelated changes | Branch name or commits span ≥ 2 distinct ticket references | Advisory warning at human gate (non-blocking) |
| 7 | Missing supplemental block | Project type is non-universal but no supplemental block in filled template | Re-assemble template with correct block; inform author |
| 8 | Missing AI disclosure | `Co-Authored-By: Claude` absent (V006) | Auto-append in assembly step |

---

## Anti-pattern 1 — Empty PR Body

**Why it harms review:** A PR with no body forces reviewers to reconstruct context from the
diff alone, increasing review time and the risk of approving changes with hidden intent or
missing context. GitHub Docs note that a meaningful description "helps collaborators
understand, approve, and build upon your work." (GitHub, *About pull requests*)

**Detection heuristic:** After the fill step, compute `len(pr_body.strip())`. If < 100
characters, the fill produced no useful content.

**Skill action:** Block Step 10 (PR creation). Treat this as a hard fill failure. Re-enter
Step 6 with a injected error: "The PR body is empty or near-empty. Every `##` section must
contain substantive content derived from the diff. Do not produce placeholder text."

---

## Anti-pattern 2 — Vague or Single-Sentence Summary ("Fix bug", "WIP", "Updates")

**Why it harms review:** Google `eng-practices` mandates that a CL description "explains
*what* is being done and *why*". A single sentence rarely supplies both. Studies of large
open-source repos show vague summaries correlate with longer review cycles and higher
post-merge defect rates. (Google, *eng-practices — Writing good CL descriptions*)

**Detection heuristic:** Rule V001 — Summary section is empty or contains < 2 sentences.
Additional signal: Summary ≤ 10 words is a strong vagueness indicator even if technically
two sentences.

**Skill action:** V001 validation error injected into retry prompt. On the retry, the error
message instructs: "Write 2–5 sentences covering what changed and the motivation or context
behind the change."

---

## Anti-pattern 3 — No Linked Issue

**Why it harms review:** GitHub Docs state that linking an issue "provides more context for
your collaborators". The Kubernetes contributor guide requires that every PR reference a
tracking issue. Without a link, reviewers cannot verify the requirement, and automated
project boards cannot track progress. (GitHub Docs, *Linking a pull request to an issue*)

**Detection heuristic:** Rule V002 — Linked Issue section contains no `Fixes #`, `Closes #`,
`Refs #`, or recognised ticket URL pattern.

**Skill action:** V002 validation error. On retry: "Add `Fixes #<number>` to close the
associated issue, or a Linear/Jira URL if the project tracks work externally. If there is
genuinely no tracking issue, write `Refs: none — standalone change` to make this explicit."

---

## Anti-pattern 4 — No Test Plan Steps

**Why it harms review:** Meta's React Native contributing guide requires a concrete Test Plan
so that reviewers can verify the change works as intended. A Test Plan with no numbered steps
is unverifiable and shifts the verification burden entirely onto the reviewer. (Meta, *React
Native CONTRIBUTING.md*)

**Detection heuristic:** Rule V003 — Test Plan section contains no numbered step pattern
(`^\s*\d+[\.\)]`). Also triggered when the section contains only `<!-- not applicable -->`.

**Skill action:** Set `confidence_test_plan = "low"`. Surface prominently at the human gate:
"⚠️ Test Plan confidence is LOW — the diff did not provide enough evidence to write concrete
test steps. Please add at least one numbered step a reviewer can execute before approving."
This is non-blocking; the human gate allows the author to strengthen the Test Plan manually.

---

## Anti-pattern 5 — Mega-PR (> 400 Non-Boilerplate Lines)

**Why it harms review:** Google `eng-practices` documents that small CLs are reviewed more
thoroughly, approved faster, and introduce fewer bugs. The 400-line threshold is derived from
the guideline that changes beyond this size routinely result in reviewers "rubber-stamping"
the diff. Kubernetes contributor guide recommends keeping PRs focused on a single logical
change. (Google, *eng-practices — Small CLs*; Kubernetes, *pull requests*)

**Detection heuristic:** `size_warning` is set (non-null) after the diff compression step.

**Skill action (non-blocking):** Prepend the following banner to `pr_body`:

```markdown
> ⚠️ **Large PR warning:** This PR changes {count} non-boilerplate lines (threshold: 400).
> Consider splitting into smaller, focused PRs for faster, higher-quality review.
> (Source: Google eng-practices, *Small CLs*)
```

Surface the warning prominently at the human gate. Do not block PR creation — the author may
have a justified reason (e.g. a large refactor that cannot be safely split).

---

## Anti-pattern 6 — Multiple Unrelated Changes

**Why it harms review:** PRs that bundle unrelated changes make it impossible for a reviewer
to reason about the risk of each change independently. If one change is reverted, the
unrelated change is lost with it. Google `eng-practices`: "Each CL should contain exactly
one self-contained change." (Google, *eng-practices — One CL at a time*)

**Detection heuristic:** Any of the following signals:
- Branch name contains ` and `, `+`, `&`, or `, ` between two words suggesting compound scope
- Commit messages reference > 2 distinct ticket IDs (e.g. `PROJ-123`, `PROJ-456`, `PROJ-789`)
- Commit messages contain > 2 distinct `type:` prefixes (Conventional Commits) covering
  unrelated domains (e.g. `feat: add auth` + `chore: update deps` + `fix: payment bug`)

**Skill action (non-blocking):** Surface an advisory at the human gate:
"⚠️ This branch may contain unrelated changes. Consider splitting into focused PRs — one
per logical change. Smaller PRs are reviewed faster and are easier to revert safely."
Do not block PR creation.

---

## Anti-pattern 7 — Missing Supplemental Block

**Why it harms review:** Project-type-specific sections (browser matrix, performance
benchmarks, model-card updates, agent-behaviour description, etc.) exist because generic
sections are insufficient for reviewers in those domains. A frontend PR without accessibility
and visual regression notes, or an ML PR without experiment metrics, leaves reviewers unable
to evaluate correctness for their domain. (Shopify Polaris CI workflow; W3C ARIA Practices;
Mitchell et al., *Model Cards for Model Reporting*, arXiv 1810.03993)

**Detection heuristic:** `project_type` is not "Universal fallback" AND the filled template
does not contain any headings from the expected supplemental block (as defined in
`references/universal-template.md`).

**Skill action:** Before entering the fill step, re-assemble the template with the correct
supplemental block appended. Inform the author in the human gate: "A {project_type}
supplemental block was added to the template because none was present. Review the new
sections below."

---

## Anti-pattern 8 — Missing AI Assistance Disclosure

**Why it harms review:** The Kubernetes contributor guide and emerging AI-use policies require
disclosure when AI tools contribute to code or documentation. Omitting the disclosure is a
transparency failure that may violate team or organisational policy. (Kubernetes contributor
guide, *AI assistance policies*)

**Detection heuristic:** Rule V006 — `pr_body` does not contain `Co-Authored-By: Claude`.

**Skill action:** The assembly step automatically appends the footer before PR creation — this
is never left to the LLM or the author. V006 is therefore informational only and does not
count toward the retry limit. If V006 fires during validation (i.e. before assembly), it is
noted but not treated as a blocking error.

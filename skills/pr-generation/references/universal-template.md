# Universal PR Template

Master PR template used by the `pr-generation` skill when generating a template from scratch.
Contains the universal base (9 required sections) and supplemental blocks for each of the 5
specialised project types.

---

## Instructions for the Skill

When assembling a generated template for a repository:

1. Always include the full universal base (all 9 sections below, in order).
2. If `project_type` is not "Universal fallback", append the matching supplemental block
   from `references/project-types.md` after the "Reviewer Checklist" section and before
   "AI Assistance Disclosure".
3. Mark inapplicable optional sections with `<!-- Delete this section if not applicable -->`
   on the line immediately after the heading.
4. Do **not** include supplemental blocks for project types other than the one detected.
5. Write the assembled template to `.github/pull_request_template.md` as an **untracked file**
   — do not stage or commit it.

---

## Universal Base Template

```markdown
## Summary

<!-- What changed and why, in 2–5 sentences.
     First sentence must be in imperative mood: "Add X", "Fix Y", "Refactor Z".
     Answer: what did you change, and why is this change needed? -->

## Linked Issue

<!-- Close or reference the associated tracking issue.
     GitHub:  Fixes #<number>  |  Closes #<number>  |  Refs #<number>
     Linear:  Fixes LIN-<number>  |  https://linear.app/...
     Jira:    https://<org>.atlassian.net/browse/<PROJ-123>
     If no tracking issue exists, write: Refs: none — standalone change -->

## Type of Change

<!-- Mark one (delete the rest): -->
- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] refactor — code change that neither fixes a bug nor adds a feature
- [ ] perf — performance improvement
- [ ] docs — documentation only
- [ ] test — adding or correcting tests
- [ ] chore — maintenance, dependency updates, build changes
- [ ] breaking — introduces a breaking change (also fill in the Breaking Change section)

## Test Plan

<!-- Numbered steps a reviewer can execute to verify this change works as intended.
     Be concrete — not "run the tests" but "run `pytest tests/auth/` and confirm all pass".

     1. Step one
     2. Step two
     3. Step three

     If no manual steps apply (e.g. pure refactor with full test coverage), write:
     1. Run `<test command>` — confirm all tests pass with no new failures. -->

## Screenshots / Recording

<!-- Delete this section if there are no UI or visual changes.
     For UI changes: include before/after screenshots or a screen recording. -->

## Breaking Change

<!-- Delete this section if there are no breaking changes.
     If this PR introduces a breaking change:
     - Describe what breaks (API contract, config format, required migration, etc.)
     - Provide the migration path for consumers -->

## Risk & Rollback

<!-- What could go wrong with this change?
     How would you roll back if the deployment fails?
     Example: "Low risk — additive change only. Rollback: revert the PR and redeploy." -->

## Reviewer Checklist

- [ ] Code follows project conventions and style guidelines
- [ ] Tests added or updated to cover the change
- [ ] Documentation updated if public API or behaviour changed
- [ ] No secrets, credentials, or PII in the diff
- [ ] Breaking change section completed (if applicable)

---

*Co-Authored-By: Claude <noreply@anthropic.com>*
```

---

## Notes on Individual Sections

### Summary

- Must answer **what** changed and **why** in 2–5 sentences.
- First sentence in imperative mood: "Add webhook support for payment events" not "Added webhook support" or "This PR adds webhook support".
- The `pr_title` is generated from the first sentence of this section, truncated to ≤ 72 characters.
- Do not repeat the PR title verbatim — the Summary should expand on it.

### Linked Issue

- If the branch name contains a ticket pattern (`PROJ-123`, `LINEAR-456`, `GH-789`, `issue/101`), the skill pre-populates this section.
- Using `Fixes #N` or `Closes #N` auto-closes the issue on merge — use `Refs #N` if the issue should remain open after this PR merges.

### Type of Change

- Only one type should be marked. If the PR mixes types (e.g. feat + chore), that is a signal it may be a multi-unrelated-change PR (see `references/anti-patterns.md`, anti-pattern 6).
- `breaking` should always be accompanied by a non-empty Breaking Change section.

### Test Plan

- The most common source of `confidence_test_plan = "low"` is a diff that has no test files changed and no clear test invocation path.
- If the diff includes new test files, cite them explicitly: "Run `pytest tests/new_feature_test.py`".
- Avoid vague steps like "test the feature manually" — the step must be reproducible by any reviewer with repo access.

### Screenshots / Recording

- Required for any change touching HTML, CSS, JSX/TSX, or UI component files.
- For accessibility changes: include a screenshot of the focus indicator state.
- Loom, GitHub's built-in recording, or any shareable link is acceptable.

### Breaking Change

- Triggered by V004 validation if the diff contains removed/renamed function signatures.
- Must describe both **what breaks** and **how to migrate**. A migration path of "update your import" is insufficient — provide the exact new call signature.

### Risk & Rollback

- For low-risk additive changes, a one-sentence assessment is sufficient.
- For high-risk changes (database migrations, auth changes, caching changes), provide a step-by-step rollback procedure.
- Cross-reference the feature flag if one is in use.

### Reviewer Checklist

- Always contains ≥ 3 unchecked items (required by V005).
- Project-type supplemental blocks add additional checklist items specific to the domain.
- Reviewers check off items as they review — the checklist is not for the author to pre-fill.

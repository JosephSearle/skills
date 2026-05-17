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

- [ ] Skill frontmatter (`name`, `description`) is complete and the `name` matches the directory exactly
- [ ] At least one trigger phrase, one numbered step, and one rule are present
- [ ] Skill does not overlap with an existing skill (checked against `README.md` index)
- [ ] Reference files are conditionally loaded (not auto-loaded) and named correctly
- [ ] `README.md` Skills Index table updated with the new or changed skill
- [ ] `bash scripts/validate-skills.sh` passes with no errors
- [ ] No secrets, credentials, or PII in the diff

---

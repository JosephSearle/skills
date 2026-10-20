# sdlc-build evals

Each eval runs against a throwaway git repo built from `files/`:

```bash
bash evals/files/setup_fixture.sh <case> <empty-dest-dir>
# case: csv-export | reminders | account-deletion
```

- `files/base-app/` — a tiny dependency-free Node task API (`npm test` works) with a `CLAUDE.md`.
- `files/cases/<case>/docs/sdlc/...` — the `intent.md` and `spec.md` for that case, in the formats
  `sdlc-plan` and `sdlc-design` produce (numbered `R`/`C` items, constraints table).
- The setup script creates realistic history: intent and spec merged to `main` via merge commits
  (`csv-export`, `account-deletion`), or the spec left on an unmerged branch (`reminders`).

Run the eval's prompt with the fixture as the working directory, then check the assertions —
`scripts/check_plan_coverage.py <repo>/docs/sdlc/<folder>` covers the coverage assertions, and
`git status` / `git log` cover the no-code / no-commit ones.

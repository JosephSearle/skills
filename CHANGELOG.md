# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 2.0.0](https://keepachangelog.com/en/2.0.0/).
This project does not use Semantic Versioning: it has no numbered releases, so changes are
grouped under the date they landed on `main`.

## [Unreleased]

### Added
- A Claude Code plugin marketplace at `.claude-plugin/marketplace.json` publishing two plugins
  built from catalog skills: "core" (the security, compliance, brand and UX policy skills) and
  "sdlc" (the SDLC workflow skills, depending on "core").
- New "sdlc-build" skill that turns an accepted `spec.md` into a reviewable `plan.md` before any
  code is written, with each step and check traced back to the spec's numbered requirements and
  a bundled script that verifies that coverage.
- New "sdlc-status" skill that reports which stage each change under `docs/sdlc/` has reached and
  the next skill to run, using a bundled script that checks acceptance against git.
- New "runbook" skill for creating and maintaining incident-response runbooks, playbooks, and
  on-call reference documentation.
- New "playbook" skill for creating and maintaining incident-response playbooks and their
  live-incident cheat sheets, for situations needing investigation or judgment rather than a
  known fix.

### Changed
- Renamed the "issue-filing" skill to "gh-issue-filing" and the "issue-template" skill to
  "gh-issue-template" to make their GitHub-specific scope explicit in the slug itself.
- Renamed the eight repo-standard-docs skills ("changelog", "code-of-conduct", "codeowners",
  "contributing", "governance", "readme", "security", "support") to a "tech-doc-" prefix (e.g.
  "tech-doc-readme") so the catalog listing groups them as one recognizable family rather than
  generic bare names.
- The "sdlc-design" skill now numbers requirements (R1, R2, ...) and areas of concern (C1, C2,
  ...) in `spec.md` and keeps those numbers stable, gives each concern an owner and an
  open/resolved status, and adds a table showing how each `intent.md` constraint is met.

### Fixed
- The "sdlc-plan" skill's description and evals no longer say it commits `intent.md` and opens
  the PR itself; it writes the file and recommends the commit message and branch.

## [2026-09-20]

### Added
- New "codeowners" skill, plus a CODEOWNERS file for the repo.
- New "changelog" skill for generating and maintaining a `CHANGELOG.md` following Keep a
  Changelog 2.0.0.
- This project's own `CHANGELOG.md`.

## [2026-09-19]

### Added
- New "issue-filing" skill for turning a rough bug report or feature idea into a well-formed
  GitHub issue.

## [2026-09-18]

### Added
- CODE_OF_CONDUCT.md for the project.
- New "support" skill, plus a SUPPORT.md describing how to get help.
- New "governance" skill, plus a GOVERNANCE.md describing project governance.
- New "pr-template" skill, plus a pull request template for the repo.
- New "issue-template" skill, plus GitHub issue templates for the repo.

### Changed
- **Breaking:** the "pull-request-description" skill was renamed to "pr-description" — update
  any references or downloads that use the old slug.

## [2026-09-16]

### Added
- New "contributing" skill, plus a CONTRIBUTING.md for the project.
- New "security" skill (initially released as "security-policy"), plus a SECURITY.md security
  policy for the project.
- New "code-of-conduct" skill.

## [2026-09-12]

### Added
- New "prompt-engineering" and "prompt-evaluation" skills.

## [2026-09-11]

### Added
- New "post-incident-calibration" skill.
- New "post-incident-report" skill.
- New "architectural-decision-record" skill.
- New "readme" skill for drafting project README files.
- Project README and MIT license.

### Changed
- **Breaking:** the "cl-creation" skill was renamed to "pull-request-description" — update any
  references or downloads that use the old slug.

### Fixed
- Corrected the catalog site's listing copy, which incorrectly implied content was rebuilt
  automatically on every deploy.

### Removed
- An unused deploy workflow that had no effect.

## [2026-09-10]

### Added
- New "pull-request-description" skill for drafting PR/CL titles, descriptions, and metadata
  (initially released as "cl-creation").
- New "conventional-commits" skill for drafting Conventional Commits-formatted commit messages
  and creating the commits.
- A browsable skills catalog site, generated statically from the catalog content.
- A CI pipeline that validates every skill's structure and eval definitions on each change.

### Changed
- Skill content moved into a top-level `catalog/` directory, separating it from the site that
  publishes it.
- Skill frontmatter now includes a human-facing summary field.

## [2026-09-08]

### Added
- Initial commit of the skills catalog repository.

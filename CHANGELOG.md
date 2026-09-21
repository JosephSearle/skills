# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 2.0.0](https://keepachangelog.com/en/2.0.0/).
This project does not use Semantic Versioning: it has no numbered releases, so changes are
grouped under the date they landed on `main`.

## [Unreleased]

### Added
- New "runbook" skill for creating and maintaining incident-response runbooks, playbooks, and
  on-call reference documentation.

### Changed
- Renamed the "issue-filing" skill to "gh-issue-filing" to make its GitHub-specific scope
  explicit in the slug itself.

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

# Badges Reference

Conventions, templates, and per-project-type recommendations for README badges using
[Shields.io](https://shields.io/).

---

## Core Format

All Shields.io badges follow this URL pattern:

```
https://img.shields.io/badge/<LABEL>-<MESSAGE>-<COLOR>
```

In Markdown, every badge must be wrapped in a link and have alt text:

```markdown
[![<alt text>](<badge URL>)](<link URL>)
```

**Rules:**
- Alt text must describe what the badge shows (used by screen readers and for broken-image fallback)
- Every badge should link somewhere relevant — the CI run, the registry page, the license text
- Use real, dynamic badges (linked to live data) over static ones wherever possible
- Static badges (`/badge/build-passing-green`) signal nothing — avoid them
- Group related badges on a single line; separate unrelated groups with a blank line

---

## Badge Placement

```markdown
# Project Name

[![CI](...)][ci-url] [![Coverage](...)][cov-url] [![Version](...)][ver-url] [![License](...)][lic-url]

Short description sentence here.
```

Place all badges between the title and the short description. Do not scatter badges throughout
the README — readers expect to find them at the top.

---

## Badge Categories

### 1. CI / Build Status

Shows whether the latest commit on the default branch passes tests.

**GitHub Actions (preferred for GitHub repos):**
```markdown
[![CI](https://github.com/<owner>/<repo>/actions/workflows/<workflow-file>.yml/badge.svg)](https://github.com/<owner>/<repo>/actions/workflows/<workflow-file>.yml)
```

Example:
```markdown
[![CI](https://github.com/org/mylib/actions/workflows/test.yml/badge.svg)](https://github.com/org/mylib/actions/workflows/test.yml)
```

**CircleCI:**
```markdown
[![CircleCI](https://circleci.com/gh/<owner>/<repo>.svg?style=shield)](https://circleci.com/gh/<owner>/<repo>)
```

**GitLab CI:**
```markdown
[![pipeline status](https://gitlab.com/<owner>/<repo>/badges/main/pipeline.svg)](https://gitlab.com/<owner>/<repo>/-/commits/main)
```

---

### 2. Code Coverage

Shows the percentage of code covered by tests.

**Codecov:**
```markdown
[![Coverage](https://img.shields.io/codecov/c/github/<owner>/<repo>)](https://codecov.io/gh/<owner>/<repo>)
```

**Coveralls:**
```markdown
[![Coverage Status](https://coveralls.io/repos/github/<owner>/<repo>/badge.svg?branch=main)](https://coveralls.io/github/<owner>/<repo>?branch=main)
```

---

### 3. Version / Release

Links to the package registry and shows the published version.

**PyPI (Python):**
```markdown
[![PyPI version](https://img.shields.io/pypi/v/<package-name>)](https://pypi.org/project/<package-name>/)
```

**npm (Node.js):**
```markdown
[![npm version](https://img.shields.io/npm/v/<package-name>)](https://www.npmjs.com/package/<package-name>)
```

**crates.io (Rust):**
```markdown
[![Crates.io](https://img.shields.io/crates/v/<crate-name>)](https://crates.io/crates/<crate-name>)
```

**pkg.go.dev (Go):**
```markdown
[![Go Reference](https://pkg.go.dev/badge/<module-path>.svg)](https://pkg.go.dev/<module-path>)
```

**GitHub Releases (language-agnostic):**
```markdown
[![GitHub release](https://img.shields.io/github/v/release/<owner>/<repo>)](https://github.com/<owner>/<repo>/releases/latest)
```

---

### 4. License

Shows the license type and links to the full text.

**Generic (any license):**
```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
```

**From GitHub (reads LICENSE file automatically):**
```markdown
[![License](https://img.shields.io/github/license/<owner>/<repo>)](LICENSE)
```

---

### 5. Downloads

Shows how often the package is downloaded — signals adoption and trust.

**PyPI (weekly downloads):**
```markdown
[![PyPI - Downloads](https://img.shields.io/pypi/dw/<package-name>)](https://pypi.org/project/<package-name>/)
```

**PyPI (monthly downloads):**
```markdown
[![PyPI - Downloads](https://img.shields.io/pypi/dm/<package-name>)](https://pypi.org/project/<package-name>/)
```

**npm (weekly):**
```markdown
[![npm downloads](https://img.shields.io/npm/dw/<package-name>)](https://www.npmjs.com/package/<package-name>)
```

**crates.io (all-time):**
```markdown
[![Crates.io Downloads](https://img.shields.io/crates/d/<crate-name>)](https://crates.io/crates/<crate-name>)
```

---

### 6. Language / Runtime Version Support

Shows which runtime versions are supported.

**PyPI — Python versions:**
```markdown
[![Python Versions](https://img.shields.io/pypi/pyversions/<package-name>)](https://pypi.org/project/<package-name>/)
```

**npm — Node.js:**
```markdown
[![node-current](https://img.shields.io/node/v/<package-name>)](https://www.npmjs.com/package/<package-name>)
```

**Custom version support (static):**
```markdown
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue)](https://www.python.org/downloads/)
[![Node 18+](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org/)
```

---

### 7. Code Quality

Links to a code quality service showing the grade or status.

**Code Climate:**
```markdown
[![Maintainability](https://api.codeclimate.com/v1/badges/<id>/maintainability)](https://codeclimate.com/github/<owner>/<repo>/maintainability)
```

**Codacy:**
```markdown
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/<id>)](https://app.codacy.com/gh/<owner>/<repo>/dashboard)
```

---

### 8. Platform Support (CLI tools)

Shows which operating systems the binary runs on.

**Cross-platform (static):**
```markdown
[![macOS](https://img.shields.io/badge/macOS-supported-brightgreen)](https://github.com/<owner>/<repo>/releases)
[![Linux](https://img.shields.io/badge/Linux-supported-brightgreen)](https://github.com/<owner>/<repo>/releases)
[![Windows](https://img.shields.io/badge/Windows-supported-brightgreen)](https://github.com/<owner>/<repo>/releases)
```

---

### 9. ML / Data Science Specific

**Hugging Face model:**
```markdown
[![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97-Model-yellow)](https://huggingface.co/<org>/<model>)
```

**Dataset:**
```markdown
[![Dataset](https://img.shields.io/badge/Dataset-<name>-blue)](https://huggingface.co/datasets/<org>/<dataset>)
```

**Model size (static):**
```markdown
[![Model Size](https://img.shields.io/badge/model%20size-7B-informational)](https://huggingface.co/<org>/<model>)
```

---

## Per-Type Recommended Badge Sets

### Library / Package

```markdown
[![CI](https://github.com/<owner>/<repo>/actions/workflows/test.yml/badge.svg)](...)
[![Coverage](https://img.shields.io/codecov/c/github/<owner>/<repo>)](...)
[![PyPI version](https://img.shields.io/pypi/v/<name>)](...)
[![Python Versions](https://img.shields.io/pypi/pyversions/<name>)](...)
[![License](https://img.shields.io/github/license/<owner>/<repo>)](LICENSE)
```

Badges that matter most: CI status, version, and downloads (signals adoption).

### CLI Tool

```markdown
[![CI](https://github.com/<owner>/<repo>/actions/workflows/test.yml/badge.svg)](...)
[![GitHub release](https://img.shields.io/github/v/release/<owner>/<repo>)](...)
[![License](https://img.shields.io/github/license/<owner>/<repo>)](LICENSE)
```

Platform support badges optional; add if the tool is known to have OS-specific issues.

### Web Application

```markdown
[![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)](...)
[![License](https://img.shields.io/github/license/<owner>/<repo>)](LICENSE)
```

Web apps rarely need version or download badges. Deployment status (Vercel, Netlify) can
replace CI badge if relevant.

### API / Web Service

```markdown
[![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)](...)
[![GitHub release](https://img.shields.io/github/v/release/<owner>/<repo>)](...)
[![License](https://img.shields.io/github/license/<owner>/<repo>)](LICENSE)
```

Consider an API uptime badge (UptimeRobot, BetterUptime) if this is a public service.

### ML / Data Science

```markdown
[![CI](https://github.com/<owner>/<repo>/actions/workflows/test.yml/badge.svg)](...)
[![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97-Model-yellow)](...)
[![License](https://img.shields.io/github/license/<owner>/<repo>)](LICENSE)
```

Add dataset and model size badges for discoverability on ML-focused platforms.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
|---|---|
| Static `build-passing` badge not connected to real CI | Misleading — signals nothing |
| Badge with no alt text | Inaccessible; fails if image URL breaks |
| Badge with no link | Provides no path to context |
| More than 8 badges | Visual noise; readers scan past them |
| Badges scattered mid-README | Readers expect them at the top |
| Badge using a CDN/mirror URL instead of shields.io | Inconsistent styling; may break |

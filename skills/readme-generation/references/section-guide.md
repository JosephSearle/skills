# README Section Guide

Complete reference for every section type in a README.md. Defines required content, quality
criteria, ordering rules, and anti-patterns for each section.

Sources: Standard-Readme specification, Make a README (makeareadme.com), banesullivan/README,
Awesome README patterns, remark-lint-preset-lint-recommended.

---

## Section Ordering

Sections must appear in this canonical order. Optional sections may be omitted entirely; they
may not be reordered relative to required sections.

```
1.  Title                          [Required]
2.  Badges                         [Optional]
3.  Short Description              [Required]
4.  Long Description / Highlights  [Optional]
5.  Table of Contents              [Conditional — required if README > 100 lines]
6.  Installation                   [Required*]
7.  Quick Start                    [Optional]
8.  Usage                          [Required*]
9.  API / Configuration            [Optional]
10. Examples                       [Optional]
11. Support                        [Optional]
12. Roadmap                        [Optional]
13. Contributing                   [Required]
14. Authors / Credits              [Optional]
15. License                        [Required — MUST be final section]
```

*Not required for documentation-only repositories.

---

## 1. Title

**What it is:** The name of the project as an `#` H1 heading.

**Rules:**
- Must match the repository name and/or package name exactly (case-sensitive where relevant)
- One H1 per README — never use more than one `#` heading
- Do not add a tagline or subtitle on the same line; those go in the Short Description
- No badges on the title line

**Good:**
```markdown
# superset
```

**Bad:**
```markdown
# superset — The Modern Data Exploration Platform  <!-- tagline belongs in description -->
## superset                                         <!-- wrong heading level -->
```

---

## 2. Badges

**What it is:** Status indicators (build, coverage, version, license) placed immediately after
the title.

**Rules:**
- Use Shields.io (`https://img.shields.io/`) as the badge service — consistent styling
- Every badge must have alt text that describes what it shows
- Group related badges on one line; separate unrelated groups with a blank line
- Maximum 6–8 badges; more than that becomes noise
- Do not include badges that are always green (they signal nothing useful)
- Load `references/badges.md` for templates and per-type recommendations

**Good:**
```markdown
[![Build](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/org/repo/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/org/repo)](https://codecov.io/gh/org/repo)
[![PyPI version](https://img.shields.io/pypi/v/mypackage)](https://pypi.org/project/mypackage/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

**Bad:**
```markdown
![Build passing](https://img.shields.io/badge/build-passing-green)  <!-- static, not real CI -->
[![](https://img.shields.io/pypi/v/mypackage)]()                    <!-- no alt text, no link -->
```

---

## 3. Short Description

**What it is:** A single paragraph (1–2 sentences) that answers "what does this project do?"

**Rules:**
- Maximum 120 characters (makeareadme.com standard)
- Must NOT start with a blockquote `>` character
- Must NOT be a heading — plain paragraph text only
- Must answer: what this is, not how it works or why it was built
- Language must be plain; no domain jargon on first appearance

**Good:**
```
A Python library for reading and writing Apache Parquet files without a JVM dependency.
```

**Bad:**
```
> A library.                                                    <!-- blockquote, too vague -->
## A tool that makes data pipelines easier                      <!-- heading, not a description -->
This project is a Python library using Arrow columnar format    <!-- jargon without definition -->
for reading parquet.
```

---

## 4. Long Description / Highlights / Background

**What it is:** Additional context that couldn't fit in the short description — motivation,
key selling points, comparisons to alternatives, or design philosophy.

**Rules:**
- Use this section when the short description leaves important "why" questions unanswered
- Can be structured as a bulleted Highlights list or as narrative paragraphs
- For a Highlights list: 3–6 bullets; each bullet names one concrete, specific feature
- Do not restate the short description verbatim
- Do not include installation or usage instructions here

**Good (Highlights list):**
```markdown
## Highlights

- **Zero JVM dependency** — reads Parquet files in pure Python using the C++ Arrow library
- **Memory-mapped reads** — processes files larger than RAM without loading them into memory
- **100% API-compatible** with `pandas.read_parquet()` — drop-in replacement
- **10× faster writes** than the PyArrow default in benchmarks on columnar data
```

**Good (Background narrative):**
```markdown
## Background

Most Python Parquet libraries shell out to a JVM process, which adds 2–3 seconds of startup
latency and requires Java to be installed. This library uses the C++ Arrow bindings directly,
giving you Parquet support with the same install footprint as NumPy.
```

---

## 5. Table of Contents

**What it is:** An auto-linked list of sections for navigation.

**Rules:**
- Required if the README will exceed approximately 100 lines after completion
- Place immediately after the Short Description (and Long Description if present)
- Use relative anchor links: `[Section Name](#section-name)` (GitHub automatically generates
  anchors from headings — lowercase, spaces become hyphens, punctuation removed)
- Maximum depth: 3 levels (`##`, `###`) — do not include `####` and deeper
- Do not include the Title or the Table of Contents itself in the TOC
- Keep entries in document order

**Good:**
```markdown
## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Command-line interface](#command-line-interface)
  - [Python API](#python-api)
- [Contributing](#contributing)
- [License](#license)
```

**Auto-generation (recommended):**
```bash
npx doctoc README.md --github
```

---

## 6. Installation

**What it is:** Step-by-step instructions for getting the project onto the user's system.

**Rules:**
- Lead with the single-line package manager command — this is what most readers need
- Specify the minimum required runtime version (e.g., "Requires Python 3.10+", "Node ≥ 18")
- List all system-level prerequisites (OS, Docker, a specific CLI tool) before the install command
- If there are multiple installation methods (pip vs conda, npm vs yarn), show all of them
- Do not mix installation with first-use steps — those belong in Quick Start or Usage
- Every command must be in a `bash` fenced code block

**Good:**
```markdown
## Installation

Requires Python 3.10 or later.

```bash
pip install fastparquet
```

For conda users:

```bash
conda install -c conda-forge fastparquet
```
```

**Bad:**
```markdown
## Installation

Run the install command (see docs for more details).   <!-- vague, no actual command -->

```
pip install fastparquet                                <!-- no language identifier on block -->
```
```

---

## 7. Quick Start / Getting Started

**What it is:** The shortest possible working example — from zero to something real happening.

**Rules:**
- Must be runnable immediately after following the Installation section
- Show input and expected output together in one block (or adjacent blocks)
- Use the actual project name and real function/command names
- Keep to under 20 lines total — longer examples belong in Usage
- This section is optional if Installation is trivial and Usage starts simply

**Good:**
```markdown
## Quick Start

```python
import fastparquet

df = fastparquet.ParquetFile("data.parquet").to_pandas()
print(df.head())
#    id       name  score
# 0   1      Alice   92.5
# 1   2        Bob   87.0
```
```

---

## 8. Usage

**What it is:** Real, working examples of the most common tasks a user will perform.

**Rules:**
- Start with the simplest use case and progress to more complex ones
- Every code block must be runnable with copy-paste — no ellipsis (`...`), no placeholder values
- Show expected output after every code block where output is meaningful
- Cover the 3–5 most common tasks, not every possible feature
- For libraries: include the import statement in every example
- For CLIs: show the full command including any required flags
- Link to dedicated documentation (docs site, wiki) for the exhaustive API — do not duplicate it here
- Use `bash` for shell commands, the project's language for code examples

**Good:**
```markdown
## Usage

### Read a Parquet file

```python
import fastparquet

pf = fastparquet.ParquetFile("sales_q4.parquet")
df = pf.to_pandas()
print(df.shape)
# (48302, 12)
```

### Write a DataFrame to Parquet

```python
import pandas as pd
import fastparquet

df = pd.DataFrame({"id": [1, 2, 3], "value": [10.0, 20.5, 30.1]})
fastparquet.write("output.parquet", df)
```
```

**Bad:**
```markdown
## Usage

See the documentation for how to use this library.   <!-- sends reader away with nothing -->

```
from mylib import do_thing
do_thing(...)                                         <!-- ellipsis, not runnable -->
```
```

---

## 9. API / Configuration

**What it is:** Documentation of the public interface — exported functions, classes, CLI flags,
or configuration file options.

**Rules:**
- Required for libraries and SDKs; strongly recommended for APIs and configurable tools
- Document every publicly exported function/class/method with: signature, parameters, return value
- For CLIs: document every flag and subcommand with its default value and allowed values
- For configuration files: show a full example config with every option annotated
- If the API surface is large (>15 public items), link to an external docs site instead of
  duplicating everything here — include the most important 5–6 items inline
- Use tables for flags/options; use code blocks for function signatures

**Good (library):**
```markdown
## API

### `ParquetFile(path, verify=False)`

Opens a Parquet file for reading.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `str` or `Path` | — | Path to the `.parquet` file |
| `verify` | `bool` | `False` | Validate checksums on open (slower) |

Returns a `ParquetFile` object.

### `ParquetFile.to_pandas(columns=None, filters=None)`

Reads the file into a `pandas.DataFrame`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `columns` | `list[str]` | `None` | Column subset; `None` reads all |
| `filters` | `list[tuple]` | `None` | Row group filters (DNF notation) |
```

**Good (CLI):**
```markdown
## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--output`, `-o` | `stdout` | Output file path |
| `--format` | `json` | Output format: `json`, `csv`, `table` |
| `--verbose`, `-v` | `false` | Enable verbose logging |
```

---

## 10. Examples

**What it is:** Additional real-world scenarios beyond the basic Usage section.

**Rules:**
- Each example must be a complete, self-contained, runnable snippet
- Name each example with a concrete task title, not a generic label
- Prefer real-world data shapes over contrived toy examples
- Link to a full `examples/` directory if more than 5 examples exist

---

## 11. Support

**What it is:** Where users go when something breaks or they have a question.

**Rules:**
- List specific channels: GitHub Issues link, Discussions, Discord, email
- Do not just say "open an issue" — link to the issue tracker directly
- Note which channel is preferred for bugs vs questions
- If the project has a security policy, link to `SECURITY.md` here

**Good:**
```markdown
## Support

- **Bug reports:** [Open a GitHub Issue](https://github.com/org/repo/issues/new/choose)
- **Questions:** [GitHub Discussions](https://github.com/org/repo/discussions)
- **Security vulnerabilities:** See [SECURITY.md](SECURITY.md)
```

---

## 12. Roadmap

**What it is:** Upcoming features and the project's direction.

**Rules:**
- Use a checkbox list for planned items; checked items are completed
- Do not include items without a realistic intention to ship them
- Update or remove this section as items ship — a stale roadmap is worse than no roadmap

**Good:**
```markdown
## Roadmap

- [x] Streaming reads for files > 2 GB
- [ ] Encryption at rest (Parquet 2.6 spec)
- [ ] Delta Lake compatibility layer
```

---

## 13. Contributing

**What it is:** How to contribute to the project.

**Rules:**
- Required in every README — even a one-line statement signals openness to contributions
- If a `CONTRIBUTING.md` exists, link to it and keep this section brief (2–3 sentences)
- If no `CONTRIBUTING.md` exists, include the minimum: how to report bugs, how to propose changes,
  and what the PR review process looks like
- State explicitly whether contributions are welcome — silence signals they are not
- Include how to set up the development environment if not covered in `CONTRIBUTING.md`

**Good (with CONTRIBUTING.md):**
```markdown
## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on
submitting bug reports, feature requests, and pull requests.
```

**Good (without CONTRIBUTING.md):**
```markdown
## Contributing

Contributions are welcome. To get started:

1. Fork the repository and create a branch from `main`
2. Install development dependencies: `pip install -e ".[dev]"`
3. Run the test suite to confirm everything passes: `pytest`
4. Open a pull request with a clear description of the change

Please open an issue before starting work on a significant change so we can discuss the approach.
```

---

## 14. Authors / Credits

**What it is:** Attribution for the people and projects that made this possible.

**Rules:**
- Include the primary author(s) with a link to their GitHub profile
- Credit third-party libraries, datasets, or research that the project builds on
- Keep this section brief — a list, not a narrative
- This section is optional; omit if the git history and GitHub contributors page are sufficient

---

## 15. License

**What it is:** The legal terms under which the software can be used.

**Rules:**
- **Must always be the final section** — no sections may follow it
- Use the full SPDX identifier (e.g., `MIT`, `Apache-2.0`, `GPL-3.0-only`)
- Include the copyright holder's name and the copyright year
- Link to the full license text in `LICENSE` or `LICENSE.md`
- Do not copy the full license text into the README — link to the file

**Good:**
```markdown
## License

[MIT](LICENSE) © 2024 Jane Smith
```

```markdown
## License

[Apache-2.0](LICENSE) © 2023–2024 Acme Corporation
```

**Bad:**
```markdown
## License

This project is licensed under the MIT License - see the LICENSE.md file for details.
<!-- Redundant prose. Just use the short form above. -->

## Support   <!-- Section after License — violation -->
```

---

## Universal Anti-Patterns

Avoid these in every README:

| Anti-pattern | Why it fails |
|---|---|
| Placeholder text (`TODO`, `Your description here`) | Reader assumes the project is unfinished |
| Bare code blocks (no language identifier) | No syntax highlighting; harder to read |
| Ellipsis in examples (`do_thing(...)`) | Not runnable; frustrates readers who copy-paste |
| Generic variable names (`myapp`, `your-token`, `example.com`) | Creates false impression of working example |
| "See the docs" without a link | Dead end; reader has no path forward |
| Stale version numbers | Signals project is unmaintained |
| Long walls of prose with no code | README needs examples; text alone is not documentation |
| Replicating the full LICENSE text | Makes README very long; the file link is sufficient |
| Multiple `#` H1 headings | Breaks screen reader navigation and table-of-contents tools |
| Sections after License | Violates Standard-Readme spec; license must be last |

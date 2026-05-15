---
name: readme-generation
description: >
  Generate a comprehensive README.md for a new project or update an existing README to meet
  top industry standards. Detects project type (library, CLI, web app, API, ML/data science,
  AI agent) and tech stack, then applies the Standard-Readme specification, makeareadme.com guidelines,
  and banesullivan quality principles to produce a complete, professional README.
  Triggers on: "create a readme", "generate readme", "write a readme", "update my readme",
  "improve the readme", "add a readme", "my readme needs work", or any instruction to create,
  generate, improve, or update a project README file.
---

# README Generation Skill

A skill for generating and updating project README.md files to industry standards. Grounded in the
[Standard-Readme specification](https://github.com/RichardLitt/standard-readme),
[Make a README](https://www.makeareadme.com/) guidelines, and the
[banesullivan quality principle](https://github.com/banesullivan/README): your documentation is a
direct reflection of your software — hold it to the same standard.

---

## Core Philosophy

A README has one job: give a complete stranger everything they need to understand, install, and use
your project without ever reading the source code. Every section must answer a real reader question:

- **Does this solve my problem?** — Description, Features/Highlights
- **Can I use this code?** — License, Requirements, Compatibility
- **How do I get started?** — Installation, Quick Start, Usage
- **Who made this and how do I get help?** — Authors, Support, Contributing

A README that answers these in order, with real examples and no placeholders, is complete. One that
does not is a liability — it signals that the software may be equally unfinished.

---

## Step 1 — Mode Detection

```
Does a README.md (or README, README.rst, README.txt) already exist in the project root?
  └─ YES → UPDATE mode:
            Read the full existing README
            Identify missing required sections and ordering violations
            Preserve all valid, accurate content — do not regenerate what is good
            Flag sections that appear outdated or contain placeholder text
  └─ NO  → CREATE mode:
            Generate a complete README from scratch using project metadata
```

---

## Step 2 — Project Analysis

Scan the project root and source directories to detect project type and extract metadata.

**Detection priority (check in order, first match wins — see `references/project-types.md` for the full tree):**

```
Is there a package.json with a "bin" field?
  └─ YES → CLI Tool (Node.js)

Is there a package.json without a "bin" field?
  └─ Does it have web framework deps (react, vue, next, nuxt, svelte, express, fastify, koa)?
      └─ YES → Web Application / API
      └─ NO  → Check for agent deps (next check below)

Does package.json declare agent framework deps?
  (@langchain/langgraph, @langchain/core, langchain)
  └─ YES → AI Agent (TypeScript/JavaScript)

Does langgraph.json exist?
  └─ YES → AI Agent (Python — LangGraph Platform project)

Do pyproject.toml, setup.py, setup.cfg, or requirements.txt declare agent deps?
  (langgraph, langchain, langchain-core, crewai, autogen, pyautogen, pydantic-ai, openai-agents)
  └─ YES → Is the project packaged for PyPI distribution (build-system + publish metadata)?
            └─ YES → Library (Python)
            └─ NO  → AI Agent (Python)

Are there *.ipynb files OR a notebooks/ or data/ directory alongside *.py?
  └─ YES → ML / Data Science

Is there a Dockerfile or k8s manifest (*.yaml with 'kind: Deployment')?
  └─ YES → Web Application / API (containerised)

Is there a pyproject.toml, setup.py, or setup.cfg?
  └─ YES → Python Library (or CLI if console_scripts entry point exists)

Is there a Cargo.toml?
  └─ YES → Rust Library (or CLI if [[bin]] section exists)

Is there a go.mod?
  └─ YES → Go Library (or CLI if main package at root or cmd/ exists)

None of the above?
  └─ Ask the user: "I couldn't determine the project type automatically. Is this a
     library, CLI tool, web application, API, ML/data science project, or an AI agent /
     agentic workflow (built with LangGraph, CrewAI, AutoGen, Pydantic AI, etc.)?"
```

**Metadata to extract per detection file:**

| File | Fields to read |
|------|----------------|
| `package.json` | name, description, version, license, scripts.test, engines.node |
| `pyproject.toml` | project.name, project.version, project.description, project.requires-python, project.license |
| `setup.py` / `setup.cfg` | name, version, description, python_requires, license |
| `Cargo.toml` | package.name, package.version, package.description, package.license, package.rust-version |
| `go.mod` | module name, go directive |
| `langgraph.json` | graphs (agent entry points), dependencies, env vars |
| `LICENSE` file | License type (match SPDX identifier from first line or filename) |

Also inspect:
- `src/`, `lib/`, `cmd/`, `api/` — understand the exported surface area
- Agent-specific directories: `src/agents/`, `src/graphs/`, `src/tools/`, `crews/`, `flows/` — understand the agent structure
- CI config files (`.github/workflows/`, `.circleci/`, `.gitlab-ci.yml`) — extract test/build badge URLs
- Existing `CONTRIBUTING.md`, `CHANGELOG.md` — link to them rather than duplicating

---

## Step 3 — Load References

Always load:
- `references/section-guide.md` — rules for every section type
- `references/project-types.md` — section configuration for the detected project type

Load conditionally:
```
Does the project have a CI config, existing shields.io badges, or did the user ask for badges?
  └─ YES → load references/badges.md
```

---

## Step 4 — Gather Required Content

Before writing, resolve all required fields. Infer from metadata files where possible. If a field
cannot be determined from the project, ask the user **once** for all missing items together:

| Required field | Where to find it | Ask if missing? |
|---|---|---|
| Project name | Package manifest `name` field | Yes |
| One-sentence description | Package manifest `description` | Yes |
| Primary language + minimum runtime version | Manifest + source files | Yes |
| Installation command | Package manager convention | Infer from project type |
| One working usage example | Source code / existing docs | Yes |
| License identifier | LICENSE file or manifest | Yes — critical |
| Repository URL | git remote, package.json `repository` | No — omit if unavailable |

Do not write placeholder text such as `Your project name here` or `TODO: add description`.
If a field is unknown and cannot be asked, leave the section incomplete and note it as a gap for
the user to fill in a comment above the section:

```markdown
<!-- TODO: Add your one-sentence description here -->
```

---

## Step 5 — Plan the README Structure

Using `references/project-types.md`, select and order sections for the detected project type.

**Canonical section order (Standard-Readme specification):**

| # | Section | Required? | Notes |
|---|---------|-----------|-------|
| 1 | Title | **Required** | Must match repo/package name |
| 2 | Badges | Optional | Place immediately after title |
| 3 | Short description | **Required** | ≤120 characters, no leading `>` |
| 4 | Long description / Highlights | Optional | Motivation, key selling points |
| 5 | Table of Contents | Conditional | Required if README will exceed 100 lines |
| 6 | Installation | **Required** | Unless documentation-only repo |
| 7 | Quick Start / Getting Started | Optional | Bridge from install to first use |
| 8 | Usage | **Required** | Unless documentation-only repo |
| 9 | API / Configuration | Optional | Libraries and APIs; all exported surface |
| 10 | Examples | Optional | Additional real-world scenarios |
| 11 | Support | Optional | Where to ask questions and report bugs |
| 12 | Contributing | **Required** | Even if just a link to CONTRIBUTING.md |
| 13 | Authors / Credits | Optional | Attribution and acknowledgements |
| 14 | License | **Required** | Must always be the final section |

**In UPDATE mode**, map each existing section to this canonical order:
- Sections in the correct position → keep and improve if needed
- Sections out of order → note the reordering to the user; do not silently restructure
- Sections not in the canonical list → preserve them between Contributing and License
- Missing required sections → add them

---

## Step 6 — Generate Content

Apply the banesullivan principle throughout: write as if the README's quality represents the
project's quality to a first-time visitor.

### Universal content rules

- **No placeholder content.** Every code example must work. If you cannot verify it, say so and
  mark it with a comment.
- **Show expected output.** After every usage code block, show what the user will see.
- **Real examples, not generic ones.** Use the actual project name, real function names, real
  flag names — not `myproject`, `foo`, or `example`.
- **Write for the first-time reader.** Do not assume domain knowledge. Define terms on first use.
- **Mobile-friendly.** Keep code block lines under 80 characters where possible. Avoid wide tables.
- **Consistent heading levels.** Use `#` for title, `##` for top-level sections, `###` for
  subsections. Never skip levels.
- **Language-identified code blocks.** Every fenced code block must have a language identifier:
  ` ```bash `, ` ```python `, ` ```typescript `, ` ```go `, ` ```json ` — never bare ` ``` `.

### Section-specific guidance

Consult `references/section-guide.md` for the complete ruleset for each section type.

### Project-type section emphasis

Consult `references/project-types.md` for which sections to emphasise, expand, or condense based
on the detected project type.

---

## Step 7 — Validate Before Writing

Check all of the following before writing to disk:

**Structure checks:**
- [ ] All required sections are present (Title, Description, Installation, Usage, Contributing, License)
- [ ] License is the final section — nothing follows it
- [ ] Table of Contents is present if the README exceeds 100 lines
- [ ] Section order follows the canonical order from Step 5

**Content checks:**
- [ ] No placeholder text remains (`TODO`, `Your name here`, `Add description`, etc.)
- [ ] All code blocks have a language identifier
- [ ] All inline links are valid relative paths (external URLs are not checked but flagged if they look stale)
- [ ] Description is ≤120 characters and does not start with `>`
- [ ] Title matches the actual project/package name

**In UPDATE mode only:**
- [ ] No valid existing content has been silently removed
- [ ] Preserved sections are improved, not degraded

---

## Step 8 — Write to Disk & Post-Write Guidance

### Write the README

Write the completed README to `README.md` in the project root.

**In UPDATE mode:** If more than 30% of the existing README would be replaced, confirm with the
user before writing. Show a summary of what will be added, changed, and removed.

### Post-write output

After writing, output the following guidance:

```bash
# Optional: lint README structure and style
npx remark README.md --use remark-preset-lint-recommended

# Optional: regenerate Table of Contents after edits
npx doctoc README.md --github
```

Also note any sections left for the user to complete (fields that could not be inferred or asked).

---

## Hard Rules

- **NEVER write a README with placeholder content** — a partial README that clearly marks gaps is
  better than one with fake filler.
- **NEVER remove existing content without confirmation** — the user may have written something
  non-obvious that looks like a gap.
- **NEVER place License before Contributing or any other section** — it must be last.
- **NEVER omit the language identifier on a code block** — it breaks syntax highlighting everywhere.
- **NEVER use generic example values** — `myapp`, `your-token`, `example.com` in a code block
  that is supposed to be runnable will break trust with the first reader who tries it.

---

## Reference Files

- `references/section-guide.md` — Complete rules for every README section type: required fields,
  quality criteria, what to include and what to omit, and anti-patterns for each section
- `references/project-types.md` — Project type detection decision tree, per-type section
  configuration tables, and emphasis/de-emphasis guidance for each of the 5 project types
- `references/badges.md` — Shields.io URL format, badge categories by project type, and
  ready-to-use badge markdown templates for GitHub Actions, PyPI, npm, crates.io, and pkg.go.dev

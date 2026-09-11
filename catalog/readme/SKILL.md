---
name: readme
description: 'Generate a comprehensive README.md for a new project, update an existing one, or audit one against industry standards without rewriting it. Follows the Standard-Readme specification (github.com/RichardLitt/standard-readme) as the strict structural standard -- exact section order and required/optional rules -- and Best-README-Template (github.com/othneildrew/Best-README-Template) as the presentational layer on top of it: badges, a centered header block, a collapsible table of contents, and a "Built With" list. Detects project type (library, CLI, web app, API, ML/data science, AI agent) and tech stack to tailor content. Triggers on: "create a readme", "generate readme", "write a readme", "update my readme", "improve the readme", "add a readme", "my readme needs work", "audit my readme", "check my readme against standards", "does my readme meet standards", or any instruction to create, generate, improve, update, review, or audit a project README file.'
summary: Generates, updates, or audits a project README.md against the Standard-Readme spec and Best-README-Template style layer.
---

# README Generation Skill

Two standards, two jobs. **Standard-Readme** is the structural spec: it fixes the section order
and says what's required, optional, and forbidden. **Best-README-Template** is the visual
convention layer: badges, a centered title block, collapsible table of contents, back-to-top
links. Treat the first as load-bearing and the second as decoration applied on top of it — never
let a Best-README-Template flourish change the Standard-Readme section order or invent a new
"required" section that the spec doesn't have.

This skill has two modes: **generate/update** (produce or revise a README on disk) and **audit**
(produce a compliance report against the spec below, changing nothing). Figure out which the user
wants before doing anything else — see Step 0.

---

## Step 0 — Which mode?

- Words like "audit," "check," "review," "does this meet standards," "what's wrong with my
  README" → **Audit mode**. Go to "Audit Mode" at the end of this file. Do not edit the file.
- Words like "create," "generate," "write," "update," "improve," "fix," "add" → **Generate/Update
  mode**. Continue to Step 1 below.
- If it's genuinely ambiguous, ask once rather than guessing — an audit that silently rewrites the
  file, or a rewrite when the user only wanted a report, both burn trust.

---

## Step 1 — Mode Detection (Generate/Update)

```
Does a README.md (or README, README.rst, README.txt) already exist in the project root?
  └─ YES → UPDATE mode:
            Read the full existing README
            Map its sections onto the canonical order below
            Preserve all valid, accurate content — do not regenerate what is good
            Flag sections that appear outdated or contain placeholder text
  └─ NO  → CREATE mode:
            Generate a complete README from scratch using project metadata
```

---

## Step 2 — Project Analysis

Scan the project root and source directories to detect project type and extract metadata.

**Detection priority (check in order, first match wins — see `references/project-types.md` for
the full tree):**

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
| `LICENSE` file | License type (match SPDX identifier from first line or filename), and the copyright holder named in it |

Also inspect:
- `src/`, `lib/`, `cmd/`, `api/` — understand the exported surface area
- Agent-specific directories: `src/agents/`, `src/graphs/`, `src/tools/`, `crews/`, `flows/`
- CI config files (`.github/workflows/`, `.circleci/`, `.gitlab-ci.yml`) — extract test/build
  badge URLs, and note that Standard-Readme treats a Badges section as **required** whenever CI
  exists (see the spec table in Step 5)
- `SECURITY.md` — if present, the README's Security section should link to it rather than
  duplicate it
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
| One-sentence (short) description | Package manifest `description` | Yes |
| Primary language + minimum runtime version | Manifest + source files | Yes |
| Installation command | Package manager convention | Infer from project type |
| One working usage example | Source code / existing docs | Yes |
| License identifier (SPDX id, `UNLICENSED`, or a file to point to) | LICENSE file or manifest | Yes — critical, see License rules below |
| Copyright owner named in License section | LICENSE file, package manifest `author`, or git history | Yes if License section will name one |
| Repository URL | git remote, package.json `repository` | No — omit if unavailable |
| Maintainer(s) — name/handle and contact | package.json `author`/`contributors`, CODEOWNERS, git history | No — omit the section if it can't be filled honestly |

Do not write placeholder text such as `Your project name here` or `TODO: add description`.
If a field is unknown and cannot be asked, leave the section incomplete and note it as a gap for
the user to fill in a comment above the section:

```markdown
<!-- TODO: Add your one-sentence description here -->
```

---

## Step 5 — Plan the README Structure

This is the section that matters most for compliance. The canonical order below is the
**Standard-Readme specification's exact structure** — it is a hard requirement, not a suggestion,
and Best-README-Template-style flourishes (badges, centered blocks, a `<details>` ToC) are layered
onto these sections, never used as an excuse to reorder or skip them.

**Canonical section order (Standard-Readme spec):**

| # | Section | Required? | Spec rule |
|---|---------|-----------|-----------|
| 1 | Title | **Required** | `H1`, must match the package/repo name |
| 2 | Banner | Optional | An image/graphic directly under the title |
| 3 | Badges | **Required if the project has any CI, else optional** | Immediately after Banner (or Title if no banner) |
| 4 | Short Description | **Required** | One sentence, no heading, directly under Title/Badges — a `blockquote` (`>`) is the Standard-Readme convention here (this differs from the old version of this skill, which forbade `>` — that was wrong) |
| 5 | Long Description | Optional | Motivation, what problem it solves, why it exists |
| 6 | Table of Contents | **Required if the README is long enough to need one** (roughly: more than ~3-4 top-level sections, or the file scrolls past one screen) | Must link every section that follows it; never lists the Title itself |
| 7 | Security | Optional | Only for projects where it's relevant (secrets, auth, network exposure); link to `SECURITY.md` if one exists rather than duplicating it |
| 8 | Background | Optional | Deeper context/history — for projects where "why does this exist" isn't already covered by Long Description |
| 9 | Install | **Required, unless the repo is truly not installable** (e.g. a pure spec/reference repo) | Must include a **Dependencies** subsection whenever the project has notable external dependencies (a specific runtime version, a system library, another required service) |
| 10 | Usage | **Required, unless the repo is truly not usable** (same exception as Install) | Must include a **CLI** subsection when the project exposes a command-line interface, documenting every command/flag or linking out if that surface is large |
| 11 | (Extra, project-specific sections) | Optional | e.g. API reference detail, Examples, Configuration, Roadmap — these live between Usage and API/Maintainers, in whatever order makes sense for the project |
| 12 | API | Optional | Only for projects with an API surface worth documenting on its own (libraries, services); mirrors the exported surface |
| 13 | Maintainer(s) | Optional | Must use this exact heading (`Maintainer` or `Maintainers`) — the spec is specific about this exact term because tooling and readers scan for it |
| 14 | Thanks | Optional | Must use this exact heading — acknowledgements, prior art, funding, inspiration |
| 15 | Contributing | **Required** | Even if it's just a link to `CONTRIBUTING.md`; should say how to run tests/lint before submitting |
| 16 | License | **Required — always the final section** | Must state either an SPDX license identifier, the literal word `UNLICENSED`, or `SEE LICENSE IN <filename>` — **and** name the copyright owner. A section that just says "MIT" with no owner, or a bare license badge with no text, does not satisfy the spec. |

Note the two places this corrects the skill's previous behavior: the Short Description **is**
conventionally a `>` blockquote per Standard-Readme (don't strip it), and Security/Background sit
**before** Install, not after Contributing.

**In UPDATE mode**, map each existing section onto this order:
- Sections in the correct position → keep and improve if needed
- Sections out of order → tell the user you're reordering them and why (cite the rule above);
  don't silently restructure without saying so
- Sections not in the canonical list (e.g. a "Roadmap" or "FAQ") → keep them as project-specific
  extra sections, positioned between Usage and Maintainers/Contributing where they logically fit
- Missing required sections → add them
- License section present but missing the SPDX id or the copyright owner → flag and fix it; this
  is the single most common spec violation

---

## Step 6 — Generate Content

Apply the banesullivan quality principle throughout: write as if the README's quality represents
the project's quality to a first-time visitor. Layer Best-README-Template's presentational
conventions on top of the Standard-Readme structure from Step 5:

### Presentational layer (Best-README-Template conventions)

Use these to make the required Standard-Readme sections easier to scan — never as a reason to add
a section the spec doesn't call for:

- **Centered header block.** Title, one-line tagline, and a row of quick-navigation links
  (`Report Bug` / `Request Feature` / `Docs`) can be centered with `<div align="center">` directly
  under the Title. This decorates the Title + Short/Long Description sections; it doesn't replace
  them.
- **Badges row.** A single row of shields.io badges (build status, license, version, downloads)
  right after the header block — see `references/badges.md` for exact URLs.
- **Collapsible Table of Contents.** Wrap the ToC in `<details><summary>Table of Contents</summary>...
  </details>` so it doesn't dominate the page. Still must link every following section, per the
  spec rule in Step 5.
- **"Built With" list.** Inside or right after Long Description, a short bullet list of the major
  frameworks/libraries the project is built on, each optionally linking to that tech's site. This
  is Best-README-Template's convention for what Standard-Readme calls part of Long Description —
  don't turn it into its own top-level numbered section.
- **Back-to-top links.** A small `(back to top)` link at the end of major sections, pointing to an
  anchor near the title. Nice for long READMEs; skip it for short ones where it just adds noise.

### Universal content rules

- **No placeholder content.** Every code example must work. If you cannot verify it, say so and
  mark it with a comment.
- **Show expected output.** After every usage code block, show what the user will see.
- **Real examples, not generic ones.** Use the actual project name, real function names, real
  flag names — not `myproject`, `foo`, or `example`.
- **Write for the first-time reader.** Do not assume domain knowledge. Define terms on first use.
- **Mobile-friendly.** Keep code block lines under 80 characters where possible. Avoid wide tables.
- **Consistent heading levels.** Use `#` for title, `##` for top-level sections, `###` for
  subsections (including the Install > Dependencies and Usage > CLI subsections). Never skip
  levels.
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

**Structure checks (Standard-Readme spec compliance):**
- [ ] Title, Short Description, Install (unless truly inapplicable), Usage (unless truly
      inapplicable), Contributing, and License are all present
- [ ] License is the final section — nothing follows it
- [ ] License states an SPDX identifier, `UNLICENSED`, or `SEE LICENSE IN <file>`, **and** names
      the copyright owner
- [ ] Badges section is present if the project has CI
- [ ] Table of Contents is present if the README is long enough to warrant one, and links every
      section that follows it
- [ ] Security and Background (if present) come before Install, not after Contributing
- [ ] Maintainer(s)/Thanks (if present) use those exact headings
- [ ] Install includes a Dependencies subsection if the project has notable external dependencies
- [ ] Usage includes a CLI subsection if the project exposes a command-line interface
- [ ] Section order overall follows the canonical order from Step 5

**Content checks:**
- [ ] No placeholder text remains (`TODO`, `Your name here`, `Add description`, etc.)
- [ ] All code blocks have a language identifier
- [ ] All inline links are valid relative paths (external URLs are not checked but flagged if they
      look stale)
- [ ] Title matches the actual project/package name

**In UPDATE mode only:**
- [ ] No valid existing content has been silently removed
- [ ] Preserved sections are improved, not degraded
- [ ] Every reordering was explicitly called out to the user, not done silently

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

## Audit Mode

Use this when the user wants to know how their README measures up, not have it rewritten. Produce
a **report**, and change nothing on disk unless the user explicitly asks you to also fix what you
found.

1. Read the existing README in full — if there isn't one, say so and report that the very first
   violation is "no README exists," then stop (that's a generate-mode task, not an audit).
2. Walk every row of the canonical section table in Step 5 and check the README against it. For
   each section, record one of: **Present & compliant**, **Present but non-compliant** (say
   exactly what's wrong — wrong position, wrong heading text, missing subsection, etc.), or
   **Missing** (say whether it's required or optional for this project).
3. Run the Step 7 content checks (placeholder text, code block language identifiers, License
   completeness, Badges-if-CI, etc.) against the actual file content.
4. Note, separately, how well the file uses the Best-README-Template presentational layer (badges,
   centered header, collapsible ToC, Built With, back-to-top) — these are style suggestions, not
   compliance failures, so keep them clearly separate from the Standard-Readme structural findings.
5. Report back as: a pass/fail summary line, then the structural findings (required sections
   first, in spec order), then the content findings, then the optional style suggestions. Be
   specific — cite the actual heading text or line found, not just "License section is wrong."
6. Offer, but don't do automatically: "Want me to fix these?" If yes, proceed through Step 4
   onward in UPDATE mode using the same findings as the task list.

---

## Hard Rules

- **NEVER write a README with placeholder content** — a partial README that clearly marks gaps is
  better than one with fake filler.
- **NEVER remove existing content without confirmation** — the user may have written something
  non-obvious that looks like a gap.
- **NEVER place License anywhere but last** — no section, required or optional, follows it.
- **NEVER state a license without also naming the copyright owner** — "MIT" alone does not satisfy
  the spec.
- **NEVER omit the language identifier on a code block** — it breaks syntax highlighting everywhere.
- **NEVER use generic example values** — `myapp`, `your-token`, `example.com` in a code block
  that is supposed to be runnable will break trust with the first reader who tries it.
- **NEVER let a Best-README-Template flourish invent a new "required" section or reorder the
  Standard-Readme structure** — badges, centered blocks, and collapsible ToCs decorate the spec's
  sections; they don't replace or reorder them.
- **In audit mode, NEVER rewrite the file** — a report is the deliverable unless the user asks for
  fixes.

---

## Reference Files

- `references/section-guide.md` — Complete rules for every README section type: required fields,
  quality criteria, what to include and what to omit, and anti-patterns for each section
- `references/project-types.md` — Project type detection decision tree, per-type section
  configuration tables, and emphasis/de-emphasis guidance for each of the 5 project types
- `references/badges.md` — Shields.io URL format, badge categories by project type, and
  ready-to-use badge markdown templates for GitHub Actions, PyPI, npm, crates.io, and pkg.go.dev

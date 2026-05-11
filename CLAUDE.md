# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A library of reusable **skills** — structured Markdown instruction sets that AI agents load at runtime to complete specific task classes reliably. There is no build system, no dependencies, and no test runner. All content is plain Markdown.

## Repository structure

```
skills/
  <skill-name>/
    SKILL.md            # the skill itself (required)
    references/         # topic- or language-specific reference files loaded by the skill
      universal.md      # always-loaded base standards (where applicable)
      <language>.md     # e.g. golang.md, python.md, typescript.md
      frameworks/       # framework-specific references (e.g. deepeval.md, ragas.md)
      scenarios/        # scenario-specific references (e.g. rag.md, agent-tool-use.md)
```

## Skill file anatomy

Every `SKILL.md` opens with YAML frontmatter:

```yaml
---
name: <skill-name>           # must match the directory name exactly
description: >
  <what the skill does and what triggers it>
---
```

The body follows a numbered steps pattern:
1. Detect context / resolve tooling
2. Load relevant reference files
3. Execute the core task
4. Write output to disk and provide run guidance

Reference files are loaded conditionally by the skill steps — they are not auto-loaded. Skills explicitly name which references to load under which conditions.

## Naming convention

**Pattern: `<domain>-<action>`** — domain first, action noun second, kebab-case, no abbreviations.

- `code-review`, `test-generation`, `git-workflow`, `prompt-engineering` ✓
- `review-code` (verb-first), `test-gen` (abbreviation), `prompt-engineer` (role noun) ✗

The `name` frontmatter field must match the directory name exactly.

## Adding a new skill

1. Create `skills/<domain>-<action>/SKILL.md`
2. Add a `references/` subdirectory for any language- or topic-specific files the skill loads
3. Complete all required frontmatter fields (`name`, `description`)
4. The skill must have at least one trigger phrase, one numbered step, and one rule
5. It must not overlap with an existing skill — check the index in `README.md` first
6. Update the Skills Index table in `README.md`

## Versioning

Skills follow Semantic Versioning:
- **Patch** — clarify wording, fix typos, add examples
- **Minor** — add optional inputs/outputs or steps that don't break existing behaviour
- **Major** — change required inputs/outputs, remove or reorder steps, change the skill's core goal

## Current skills

| Skill | What it does |
|-------|-------------|
| `code-review` | Structured PR reviews with severity classification and inline/general comment posting; language refs for Go, TypeScript, Python, Terraform; LLM security checks |
| `git-workflow` | End-to-end GitHub repo management: branching (GitHub Flow / Git Flow / TBD), Conventional Commits v1.0.0, PRs, merging, SemVer releases, branch cleanup |
| `llm-eval-generation` | Eval tests for LLM-integrated code (RAG, agents, tool-use, structured output, safety); scenario detection, framework detection (DeepEval/RAGAS/Promptfoo), multi-trial requirements |
| `prompt-engineering` | Prompt design for agent nodes and pipelines; archetype identification; technique selection (Zero-Shot, CoT, ReAct, ToT, Reflexion, etc.); hardening checklist |
| `test-generation` | Unit, integration, and benchmark tests for Python (pytest), TypeScript (Jest/Vitest), and Go (stdlib + go-cmp); language/framework auto-detection; AAA structure |

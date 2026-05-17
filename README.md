# agent-skills

A curated library of reusable skills for AI agents — structured Markdown instruction sets that agents load at runtime to complete specific task classes reliably.

## Background

Modern AI agents work best when given focused, composable capabilities rather than monolithic prompts. This repository provides a growing library of **skills** — discrete, well-scoped instruction sets — that agents can load at runtime to complete tasks in a consistent, predictable way.

Each skill is:

- **Self-contained** — all context an agent needs is in the skill file itself
- **Composable** — skills can be combined without conflict
- **Versioned** — breaking changes are tracked so downstream agents can pin to a specific version

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Skills Index](#skills-index)
- [Support](#support)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Installation

Clone the repository to wherever your agent runtime expects to resolve skills:

```bash
git clone https://github.com/josephsearle/agent-skills.git
```

No dependencies are required — skills are plain Markdown files.

## Usage

Point your agent at a skill file to load its instructions at runtime. The agent reads `SKILL.md` and follows its numbered steps.

**With Claude Code** — reference a skill in your `CLAUDE.md` or pass it directly in a session:

```bash
# Read a skill's instructions into the current session
cat skills/code-review/SKILL.md
```

**With a LangGraph or CrewAI agent** — load the skill content and inject it into the system prompt:

```python
from pathlib import Path

skill = Path("skills/code-review/SKILL.md").read_text()
# Pass `skill` as the system message or a tool response in your agent graph
```

**With any agent** — skills are plain text and work with any framework that can read a file and include its contents in a prompt.

### Reference files

Many skills load additional context from their `references/` subdirectory (language-specific rules, framework guides, scenario templates). The skill's numbered steps tell the agent exactly which reference files to load and under what conditions — they are not auto-loaded.

```
skills/
  <skill-name>/
    SKILL.md            # the skill itself — always loaded
    references/
      universal.md      # always-loaded base standards (where applicable)
      <language>.md     # e.g. golang.md, python.md, typescript.md
      frameworks/       # framework-specific references
      scenarios/        # scenario-specific references
```

## Skills Index

| Skill | Description |
|-------|-------------|
| [architecture-docs](skills/architecture-docs/SKILL.md) | Generate comprehensive architectural documentation for a new or existing project: detects architecture style (Monolith, Microservices, Serverless, Event-Driven), scans the technology stack, inventories existing docs for gaps, and writes a complete `docs/architecture/` tree with native C4 Model Mermaid diagrams, Architecture Decision Records, and stakeholder-aware narrative sections |
| [code-review](skills/code-review/SKILL.md) | Perform structured code reviews on GitHub PRs: severity classification, inline and general comment posting, approval decisions, universal security checklist, and language-specific checks for Go, TypeScript, Python, and Terraform |
| [dataset-preparation](skills/dataset-preparation/SKILL.md) | Transform raw data (CSV, JSON, PDF, images, audio) into Unsloth-compatible training datasets: detects target model type (LLM, Vision, TTS, Embedding), applies the correct chat template, and writes a `prepare_dataset.py` script to disk |
| [git-workflow](skills/git-workflow/SKILL.md) | Manage a GitHub repository end-to-end: branching strategy, Conventional Commits v1.0.0, pull requests, merging, releases, and branch cleanup — with MCP server, `gh` CLI, and `git` CLI tooling guidance |
| [llm-eval-generation](skills/llm-eval-generation/SKILL.md) | Generate evaluation tests for LLM-integrated code: RAG pipelines, agents, tool-calling systems, structured output, chatbots, and code generators — grounded in ISO 42001, NIST AI RMF, HELM, and the OpenAI Skill Eval Framework, with scenario-specific metrics and framework guidance for DeepEval, RAGAS, and Promptfoo |
| [model-deployment](skills/model-deployment/SKILL.md) | Export a fine-tuned Unsloth model and generate deployment configuration: selects export format (GGUF, merged 16-bit, LoRA adapter) and writes `export.py` plus platform-specific deployment commands for Ollama, vLLM (including LoRA hot swap), SGLang, LM Studio, and llama-server |
| [model-finetuning](skills/model-finetuning/SKILL.md) | Generate a complete `train.py` using Unsloth for fine-tuning LLMs, Vision, Embedding, or TTS models: detects VRAM constraints, selects training method (QLoRA, LoRA, GRPO, DPO, CPT), configures hyperparameters, and writes a runnable training script with checkpoint and early-stopping configuration |
| [prompt-engineering](skills/prompt-engineering/SKILL.md) | Design and generate effective prompts for AI agents, graph nodes, and multi-agent pipelines — including technique selection, archetype-based templates (ReAct, CoT, ToT, Reflexion, and more), and a prompt hardening checklist |
| [pr-generation](skills/pr-generation/SKILL.md) | Generate a high-quality GitHub pull request description and open the PR: detects or generates a project-appropriate PR template (Web/Frontend, Backend/API, Full-stack, Data/ML/AI, MCP/AI-agent), compresses the diff, fills the template with Claude via structured output, validates all required sections, and requires human approval at a mandatory gate before posting via `gh` CLI or GitHub API |
| [readme-generation](skills/readme-generation/SKILL.md) | Generate or update a project README.md to top industry standards: detects project type (library, CLI, web app, API, ML/data science), extracts metadata from package manifests, applies Standard-Readme spec and makeareadme.com guidelines, and produces all required sections with real, runnable examples |
| [skill-linting](skills/skill-linting/SKILL.md) | Review a SKILL.md file against all authoring standards: frontmatter validity, naming convention, body structure, README registration, trigger phrase presence, imperative voice in steps, reference file existence, and version correctness — produces a severity-classified Blocker/Major/Minor/Nit report with a PASS/FAIL verdict |
| [spike-generation](skills/spike-generation/SKILL.md) | Generate or update a technical spike document; detects spike type (technical, functional, architecture, research, design, prototyping, performance, usability, data); applies Beck/Cohn timebox principles and SAFe 6.0 Enabler Story standards; supports both create-from-scratch and gap-fill update modes |
| [test-generation](skills/test-generation/SKILL.md) | Generate unit tests, integration tests, and benchmarks for Python, TypeScript, and Go — grounded in ISO/IEC 29119, NIST IR 8397, and ISTQB conventions, with language-specific idioms for pytest, Jest/Vitest, and the Go testing package |

## Support

Open an issue if you find a bug in a skill, have a feature request, or want to propose a new category.

## Roadmap

- [x] Automated skill validation on pull request (frontmatter linting)
- [ ] Skill versioning and changelog conventions
- [ ] Agent integration examples for Claude Code, LangGraph, and CrewAI
- [ ] Composite skill bundles (multiple skills loaded together)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for authoring guidelines, naming conventions, and the review process.

To add a new skill:

1. Fork the repository and create a feature branch
2. Create `skills/<domain>-<action>/SKILL.md` following the naming convention in `CONTRIBUTING.md`
3. Add a `references/` subdirectory for any language- or topic-specific files the skill loads
4. Complete all required frontmatter fields (`name`, `description`) — incomplete skills will not be merged
5. Update the Skills Index table in this README
6. Open a pull request with a short description of what the skill does and why it belongs here

## License

[MIT](LICENSE) © 2026 Joseph Searle

# Agent Skills

A curated library of reusable skills for AI agents. Each skill is a structured, self-contained instruction set that an agent can consume to reliably complete a specific class of task.

## Table of Contents

- [Background](#background)
- [Installation](#installation)
- [Usage](#usage)
- [Skills Index](#skills-index)
- [Contributing](#contributing)
- [License](#license)

## Background

Modern AI agents work best when given focused, composable capabilities rather than monolithic prompts. This repository provides a growing library of **skills** — discrete, well-scoped instruction sets — that agents can load at runtime to complete tasks in a consistent, predictable way.

Each skill is:
- **Self-contained** — all context an agent needs is in the skill file itself
- **Composable** — skills can be combined without conflict
- **Versioned** — breaking changes are tracked so downstream agents can pin

## Installation

Clone the repository to wherever your agent runtime expects to resolve skills:

```bash
git clone https://github.com/josephsearle/agent-skills.git
```

No dependencies are required — skills are plain Markdown files.

### Creating a new skill

Create a new directory under `skills/` and add a `SKILL.md` file inside it:

```bash
mkdir skills/<skill-name>
touch skills/<skill-name>/SKILL.md
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for authoring guidelines, naming conventions, and the review process.

## Skills Index

| Skill | Description |
|-------|-------------|
| [architecture-docs](skills/architecture-docs/SKILL.md) | Generate comprehensive architectural documentation for a new or existing project: detects architecture style (Monolith, Microservices, Serverless, Event-Driven), scans the technology stack, inventories existing docs for gaps, and writes a complete docs/architecture/ tree with native C4 Model Mermaid diagrams, Architecture Decision Records, and stakeholder-aware narrative sections |
| [code-review](skills/code-review/SKILL.md) | Perform structured code reviews on GitHub PRs: severity classification, inline and general comment posting, approval decisions, universal security checklist, and language-specific checks for Go, TypeScript, Python, and Terraform |
| [dataset-preparation](skills/dataset-preparation/SKILL.md) | Transform raw data (CSV, JSON, PDF, images, audio) into Unsloth-compatible training datasets: detects target model type (LLM, Vision, TTS, Embedding), applies the correct chat template, and writes a `prepare_dataset.py` script to disk |
| [git-workflow](skills/git-workflow/SKILL.md) | Manage a GitHub repository end-to-end: branching strategy, Conventional Commits v1.0.0, pull requests, merging, releases, and branch cleanup — with MCP server, `gh` CLI, and `git` CLI tooling guidance |
| [llm-eval-generation](skills/llm-eval-generation/SKILL.md) | Generate evaluation tests for LLM-integrated code: RAG pipelines, agents, tool-calling systems, structured output, chatbots, and code generators — grounded in ISO 42001, NIST AI RMF, HELM, and the OpenAI Skill Eval Framework, with scenario-specific metrics and framework guidance for DeepEval, RAGAS, and Promptfoo |
| [model-deployment](skills/model-deployment/SKILL.md) | Export a fine-tuned Unsloth model and generate deployment configuration: selects export format (GGUF, merged 16-bit, LoRA adapter) and writes `export.py` plus platform-specific deployment commands for Ollama, vLLM (including LoRA hot swap), SGLang, LM Studio, and llama-server |
| [model-finetuning](skills/model-finetuning/SKILL.md) | Generate a complete `train.py` using Unsloth for fine-tuning LLMs, Vision, Embedding, or TTS models: detects VRAM constraints, selects training method (QLoRA, LoRA, GRPO, DPO, CPT), configures hyperparameters, and writes a runnable training script with checkpoint and early-stopping configuration |
| [prompt-engineering](skills/prompt-engineering/SKILL.md) | Design and generate effective prompts for AI agents, graph nodes, and multi-agent pipelines — including technique selection, archetype-based templates (ReAct, CoT, ToT, Reflexion, and more), and a prompt hardening checklist |
| [test-generation](skills/test-generation/SKILL.md) | Generate unit tests, integration tests, and benchmarks for Python, TypeScript, and Go — grounded in ISO/IEC 29119, NIST IR 8397, and ISTQB conventions, with language-specific idioms for pytest, Jest/Vitest, and the Go testing package |


## Contributing

Contributions are welcome. To add or improve a skill:

1. Fork the repository and create a feature branch
2. Copy [templates/skill.md.template](templates/skill.md.template) into the appropriate category directory
3. Complete every required frontmatter field — incomplete skills will not be merged
4. Open a pull request with a short description of what the skill does and why it belongs here

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full authoring guidelines, naming conventions, and review criteria.

## Support

Open an issue if you find a bug in a skill, have a feature request, or want to propose a new category.

## Roadmap

- [ ] Automated skill validation on pull request (frontmatter linting)
- [ ] Skill versioning and changelog conventions
- [ ] Agent integration examples for Claude Code, LangGraph, and CrewAI
- [ ] Composite skill bundles (multiple skills loaded together)

## License

[MIT](LICENSE)

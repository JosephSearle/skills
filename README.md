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

Add a new Markdown file to the appropriate category directory under `skills/`:

```bash
touch skills/<category>/<skill-name>.md
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for authoring guidelines and the review process.

## Skills Index

| Skill | Description |
|-------|-------------|
| [prompt-engineer](skills/prompt-engineer/SKILL.md) | Design and generate effective prompts for AI agents, graph nodes, and multi-agent pipelines — including technique selection, archetype-based templates (ReAct, CoT, ToT, Reflexion, and more), and a prompt hardening checklist |
| [git-workflow](skills/git-workflow/SKILL.md) | Manage a GitHub repository end-to-end: branching strategy, Conventional Commits v1.0.0, pull requests, merging, releases, and branch cleanup — with MCP server, `gh` CLI, and `git` CLI tooling guidance |
| [code-review](skills/code-review/SKILL.md) | Perform structured code reviews on GitHub PRs: severity classification, inline and general comment posting, approval decisions, universal security checklist, and language-specific checks for Golang, TypeScript, and Python grounded in the Google style guides |

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

# skills

[![CI](https://github.com/JosephSearle/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/JosephSearle/skills/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A catalog of Claude Code skills, published as a browsable, downloadable site by a companion Next.js app.

## Table of Contents

- [Background](#background)
- [Install](#install)
  - [Dependencies](#dependencies)
- [Usage](#usage)
  - [Using a skill in Claude Code](#using-a-skill-in-claude-code)
  - [Running the catalog site](#running-the-catalog-site)
- [Skill structure](#skill-structure)
- [Contributing](#contributing)
- [License](#license)

## Background

Each subdirectory under [catalog/](catalog/) is one self-contained Claude Code skill: a
`SKILL.md` describing when and how Claude should use it, plus optional reference docs, scripts,
and evals. The [site/](site/) app reads that catalog at build time and turns it into a static
site where each skill can be browsed or downloaded as a `.skill` archive — adding, editing, or
removing a skill under `catalog/` requires no frontend code changes.

## Install

This repo has two independent parts, and installation depends on which one you want.

To use a skill with Claude Code, no install step is needed beyond copying or symlinking it — see
[Usage](#usage) below.

To run the catalog site locally:

```bash
cd site
npm install
```

### Dependencies

- Node.js (see [site/package.json](site/package.json) for the exact toolchain: Next.js 15, React 19)
- No dependencies are required to read or use a skill directly from `catalog/`

## Usage

### Using a skill in Claude Code

Skills are loaded from `.claude/skills/` by the Claude Code harness, not from `catalog/` directly.
Copy or symlink the one you want into your project:

```bash
mkdir -p .claude/skills
cp -r catalog/pr-description .claude/skills/
```

Claude Code picks it up automatically the next time it lists available skills. You can also
download any skill as a `.skill` archive from the published catalog site.

### Running the catalog site

```bash
cd site
npm run dev
```

```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
```

`npm run dev` regenerates `site/generated/skills-index.json` from `catalog/` before starting
(via the `predev` hook), so any skill you add is reflected immediately.

To produce the static export used in production:

```bash
cd site
npm run build
```

The output is written to `site/out/`.

## Skill structure

Every skill under `catalog/` follows the same shape:

```
catalog/<skill-name>/
├── SKILL.md          # required: YAML frontmatter (name, description, summary) + instructions
├── references/        # optional: supporting docs loaded conditionally by the skill
├── scripts/            # optional: helper scripts the skill can invoke
└── evals/
    └── evals.json      # optional: structured eval cases, checked by npm run validate:evals
```

`SKILL.md` frontmatter is validated on every CI run — a missing `name`, `description`, or
`summary` field fails the build (see [site/scripts/build-skills-index.mjs](site/scripts/build-skills-index.mjs)).

## Contributing

Contributions are welcome. To add or change a skill:

1. Add or edit a folder under `catalog/`, following the [structure](#skill-structure) above
2. From `site/`, run `npm run build:index` to confirm the skill is picked up and passes validation
3. Run `npm run validate:evals` if the skill includes `evals/evals.json`
4. Run `npm run lint:ci` and `npm run typecheck` from `site/` before opening a pull request

See [CLAUDE.md](CLAUDE.md) for the full repository layout and command reference, and
[REVIEW.md](REVIEW.md) for what a review looks for.

## License

[MIT](LICENSE) © 2026 Joseph Searle

# Contributing

Thanks for considering a contribution to this catalog. Contributions of all kinds count here, not
just new skills: fixing a `SKILL.md` that gives Claude bad instructions, improving the site,
tightening an eval, or just filing a good bug report all help.

## Security issues

Found a security vulnerability? Please don't open a public issue — see [SECURITY.md](SECURITY.md)
for how to report it privately.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating
in issues and pull requests.

## Project layout

This repo has two independent parts (see [CLAUDE.md](CLAUDE.md) for the full breakdown):

- **`catalog/`** — the skill content itself. Each subdirectory is one skill.
- **`site/`** — the Next.js app that publishes `catalog/` as a browsable, downloadable site. It
  has its own `package.json`; all commands below run from inside `site/`.

## Ground rules

- Keep changes scoped: a skill change and a site change are usually better as separate PRs.
- Don't hand-edit `site/generated/`, `site/public/downloads/`, or `site/out/` — they're build
  artifacts regenerated from `catalog/`.
- Make sure the checks in [Getting started](#getting-started-dev-setup) pass before opening a PR.

## Getting started (dev setup)

```bash
git clone <your fork>
cd skills/site
npm install
```

Adding or editing a skill requires no frontend code changes — just add/edit a folder under
`catalog/<skill-name>/` following the [structure documented in the README](README.md#skill-structure)
(a `SKILL.md` with `name`, `description`, and `summary` frontmatter, plus optional `references/`,
`scripts/`, `evals/`).

Before opening a pull request, from `site/`, run:

```bash
npm run build:index      # validates every SKILL.md and regenerates the index/downloads
npm run validate:evals    # structurally validates any catalog/*/evals/evals.json
npm run lint:ci            # biome ci . — matches what CI runs
npm run typecheck
npm run test               # vitest unit tests
```

`npm run dev` and `npm run build` also regenerate the index automatically via their pre-hooks, so
a new or edited skill shows up without any extra step.

## Minor vs. major changes

Typo fixes, wording tweaks, and small `SKILL.md` corrections can go straight to a pull request —
no need to open an issue first. For anything that changes a skill's behavior, adds a new skill, or
touches `site/` architecture, please open an issue first to talk through the approach before
investing time in the implementation.

## Reporting a bug

If you find a security issue (e.g. something that could make a skill exfiltrate data or execute
unintended commands), please don't open a public issue — see [SECURITY.md](SECURITY.md) for how to
report it privately instead.

For a regular bug, please include:

- What you did (repro steps) and what you expected to happen
- What actually happened (error output, or the incorrect behavior)
- Whether it's a `catalog/` skill issue or a `site/` issue, and which skill/page
- Your environment: Node version, OS, and whether you hit it via `npm run dev`/`build` or the
  published site

## Suggesting an enhancement

Before proposing a new skill or a site feature, take a look at the existing skills under
`catalog/` and this repo's [README](README.md) to see if it overlaps with something that already
exists. A good proposal includes:

- The problem you're trying to solve, with a concrete example
- Why it belongs as a new/changed skill or site feature rather than something you keep in your own
  `.claude/skills/` locally
- For a new skill: what would trigger Claude to use it, and roughly what it would cover

## Pull request process

1. Fork the repo and create a branch off `main`.
2. Make your change, keeping it scoped per the [ground rules](#ground-rules) above.
3. Run the checks listed in [Getting started](#getting-started-dev-setup) — CI runs the same
   `lint-format`, `typecheck`, `unit-tests`, `build-index`, `validate-evals`, and `e2e` checks on
   every pull request (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).
4. Open the pull request against `main`. All CI checks must pass before merge; expect a review
   from the maintainer.

## Style

- Code is formatted and linted with [Biome](https://biomejs.dev/) — run `npm run format` from
  `site/` rather than hand-formatting.
- For `SKILL.md` content style, follow the shape of an existing skill under `catalog/` as your
  template.

See [REVIEW.md](REVIEW.md) for what a review of your change actually looks for.

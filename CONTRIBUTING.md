# Contributing

## Adding a skill

1. Pick the right category directory under `skills/` — if none fits, open an issue to propose a new one before adding a directory
2. Create `skills/<category>/<kebab-case-name>.md`
3. Write clear, imperative steps — an agent reading this for the first time should not need to infer intent
4. Open a pull request

## Naming conventions

- File names: `kebab-case.md`
- Skill `name` field: `Title Case`
- Keep names specific — `review-python-types` is better than `code-review`

## Review criteria

A skill will be merged when it:
- Has complete and valid frontmatter
- Has at least one trigger, one step, and one rule
- Does not overlap with an existing skill (check the index in README.md first)
- Has been tested against at least one real agent run

## Versioning

Follow [Semantic Versioning](https://semver.org/):
- **Patch** — clarify wording, fix typos, add examples
- **Minor** — add optional inputs/outputs, add steps that don't break existing behaviour
- **Major** — change required inputs/outputs, remove or reorder steps, change the skill's core goal

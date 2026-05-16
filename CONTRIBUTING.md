# Contributing

## Local setup (optional but recommended)

After cloning, link the pre-commit hook so the validator runs before every commit:

```bash
ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x scripts/pre-commit.sh
```

This runs `scripts/validate-skills.sh` automatically on each commit and also runs
`markdownlint` if it is installed (`npm install --global markdownlint-cli`).

The same checks run on every pull request via GitHub Actions, so the hook is optional
but catches issues earlier.

## Adding a skill

1. Create a new directory under `skills/`: `skills/<skill-name>/`
2. Add a `SKILL.md` file inside it: `skills/<skill-name>/SKILL.md`
3. Add a `references/` subdirectory for any language- or topic-specific reference files the skill loads
4. Write clear, imperative steps — an agent reading this for the first time should not need to infer intent
5. Update the Skills Index table in `README.md`
6. Run `bash scripts/validate-skills.sh` to verify the skill passes all structural checks
7. Open a pull request

## Naming conventions

**Pattern: `<domain>-<action>`** — domain first, action noun second, kebab-case, no abbreviations.

| Element | Rule | Example |
|---|---|---|
| Directory name | `<domain>-<action>` kebab-case | `code-review`, `test-generation` |
| `name` frontmatter field | Must match the directory name exactly | `name: code-review` |
| Action noun | Full word — no abbreviations | `test-generation` not `test-gen` |
| Second word type | Noun form of the action, not a verb or role | `prompt-engineering` not `prompt-engineer` |

**Applying the pattern:**

- What domain does the skill operate on? → first word (`code`, `git`, `test`, `prompt`)
- What does the skill do to that domain? → second word, as a noun (`review`, `workflow`, `generation`, `engineering`)

**Valid:** `code-review`, `git-workflow`, `prompt-engineering`, `test-generation`, `security-review`, `doc-generation`

**Invalid:** `review-code` (verb-first), `test-gen` (abbreviation), `prompt-engineer` (role noun, not action noun)

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

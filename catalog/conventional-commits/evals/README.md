# Evals

`evals.json` defines eval cases for this skill: a prompt, a repo fixture, and an `expected_output` description of what a correct run looks like.

**What CI checks automatically:** `npm run validate:evals` (wired into the `validate-evals` CI job) only validates that `evals.json` is well-formed — required fields present, non-empty prompts, no duplicate ids. It does not run the skill against a model or grade the output.

**What "running" an eval currently means:** invoke the skill (e.g. via `/conventional-commits` or the equivalent slash command) against each `prompt`, point it at a scratch copy of the relevant repo state, and manually compare the result against `expected_output`. Do this before merging a change to `SKILL.md` that could alter behavior, or periodically as a regression check.

There is no scripted, automated grader yet. If one is built later (e.g. an LLM-judged runner in CI), update this note and the `validate-evals` job accordingly.

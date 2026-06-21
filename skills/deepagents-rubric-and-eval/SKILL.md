---
name: deepagents-rubric-and-eval
version: 1.0.0
description: >
  Deep Agents RubricMiddleware — LLM-as-judge runtime evaluation, grader subagent, per-criterion
  feedback, and integration with llm-evaluation and observability skills. Triggers on:
  RubricMiddleware, rubric middleware, grader subagent, LLM-as-judge runtime, self-evaluated
  agent, max_iterations rubric, per-criterion feedback, rubric checklist invocation state,
  deepagents>=0.6.5, rubric beta. Requires deepagents>=0.6.5 (beta — API may change).
---

## Core Philosophy

`RubricMiddleware` implements the LLM-as-judge pattern at **runtime** — not as a post-hoc evaluation step but as an inline gate that can trigger re-iteration. A dedicated grader subagent scores the agent's output against a rubric, provides per-criterion feedback, and the main agent retries until the rubric is satisfied or `max_iterations` is exhausted. The rubric is supplied per-invocation (not baked into the agent configuration), so the same agent can be evaluated against different rubrics for different tasks. Because `RubricMiddleware` is beta, treat its API surface as subject to change; pin `deepagents==0.6.*` and review the changelog before upgrading.

---

## Step 1 — Determine Context

| Signal | Sub-topic | Reference to load |
|---|---|---|
| `RubricMiddleware` setup, `max_iterations`, grader model, beta caveats | RubricMiddleware API | `references/rubric-middleware.md` |
| Integration with `llm-evaluation` or `observability` skills, multi-model setup, tracing | Integration patterns | `references/integration.md` |
| General "how does rubric evaluation work?" | Both | Load both references |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/rubric-middleware.md` | RubricMiddleware API, rubric format, grader subagent behaviour, iteration semantics | Any RubricMiddleware setup or debugging question |
| `references/integration.md` | Integration with llm-evaluation/observability skills, multi-model patterns, trace inspection | Integration with evaluation or observability infrastructure |

---

## Step 3 — Implement

### Minimal pattern

```python
from deepagents import create_deep_agent, RubricMiddleware

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",      # production model — does the task
    middleware=[
        RubricMiddleware(
            model="anthropic:claude-haiku-4-5",  # grader model — cheaper, faster
            max_iterations=3,
        )
    ],
)

# Rubric is supplied at invocation time via the state
result = agent.invoke(
    {
        "messages": [{"role": "user", "content": "Write a one-page summary of quantum computing."}],
        "rubric": "\n".join([
            "The summary is exactly one page (400-500 words).",
            "It mentions superposition and entanglement.",
            "It includes at least one real-world application.",
            "It is written for a non-technical audience.",
            "It does not contain any factual errors.",
        ]),
    },
    config={"configurable": {"thread_id": "session-1"}},
)
```

### When to use RubricMiddleware vs post-hoc evaluation

```
Evaluation timing?
  └─ During the agent run (gate before returning to user)
     → RubricMiddleware — inline, can trigger re-iteration
  └─ After the agent run (offline, batch, CI)
     → See llm-evaluation skill — external evaluator, no re-iteration

Does the output need to satisfy the rubric before the user sees it?
  └─ YES → RubricMiddleware
  └─ NO  → Post-hoc evaluation (llm-evaluation skill) is cheaper and simpler
```

### Mandatory checklist for RubricMiddleware

| Concern | Requirement |
|---|---|
| Beta status | `deepagents>=0.6.5` required; API may change before GA — pin version |
| Rubric format | Newline-delimited checklist; each line is one criterion |
| Grader model cost | Use a cheaper model (e.g. Haiku) for grading to keep cost down |
| max_iterations | Set conservatively (2–4); high values risk looping on unsatisfiable rubrics |
| No rubric = no grading | If `rubric` is omitted from invocation state, RubricMiddleware is a no-op |
| Grader can call tools | The grader subagent can call tools to reason over the transcript — plan for this in token budget |

---

## Step 4 — Verify

```bash
# Confirm RubricMiddleware is available (requires deepagents>=0.6.5)
uv run python -c "
from deepagents import RubricMiddleware
print('RubricMiddleware import ok')
import deepagents; print('version:', deepagents.__version__)
"

# Verify rubric-gated invocation
uv run python -c "
from deepagents import create_deep_agent, RubricMiddleware

agent = create_deep_agent(
    model='anthropic:claude-sonnet-4-6',
    middleware=[RubricMiddleware(model='anthropic:claude-haiku-4-5', max_iterations=2)],
)

result = agent.invoke(
    {
        'messages': [{'role': 'user', 'content': 'List three prime numbers.'}],
        'rubric': 'The response contains exactly three prime numbers.\nAll numbers listed are actually prime.',
    },
    config={'configurable': {'thread_id': 'test-rubric-1'}},
)
print(result['messages'][-1].content)
print('rubric evaluation completed')
"
```

---

## Reference Files

| File | Domain | Load when |
|---|---|---|
| [references/rubric-middleware.md](references/rubric-middleware.md) | RubricMiddleware API, rubric format, grader subagent, iteration semantics, beta caveats | Any RubricMiddleware setup or API question |
| [references/integration.md](references/integration.md) | Integration with llm-evaluation and observability skills, multi-model grading, LangSmith trace inspection | Integration with evaluation/observability infrastructure |

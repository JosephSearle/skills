# Integration Reference — RubricMiddleware with llm-evaluation & observability

---

## Integration with llm-evaluation skill

`RubricMiddleware` and the `llm-evaluation` skill serve different purposes and complement each other:

| | RubricMiddleware | llm-evaluation skill |
|---|---|---|
| When | At runtime, inline in the agent run | Post-hoc, offline, or in CI |
| Effect | Can trigger re-iteration before response | Records quality score; no re-iteration |
| Cost | Paid per request (grader model + possible retries) | Paid per evaluation run (batched) |
| Use for | Quality gating per production request | Dataset-level evaluation, regression testing |
| Rubric format | Newline checklist per invocation | Configurable (DeepEval/RAGAS/Promptfoo) |

**Recommended combination:** Use `RubricMiddleware` in production for per-request quality gating on high-stakes outputs. Use the `llm-evaluation` skill to evaluate a sample dataset offline and catch regressions across versions.

---

## Integration with observability skill

`RubricMiddleware` grader runs appear as child spans in LangSmith and MLflow traces. Connect with the `observability` skill to:

1. **Track rubric pass rates over time** — monitor the percentage of requests that require retries.
2. **Identify consistently-failing criteria** — detect rubric criteria that are frequently failed, which may indicate the rubric is too strict or the model is misaligned.
3. **Monitor grader cost** — track grader model tokens separately from the main agent tokens.

```python
# Enable MLflow tracing (see observability skill)
import mlflow
mlflow.langchain.autolog()

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    middleware=[RubricMiddleware(model="anthropic:claude-haiku-4-5", max_iterations=3)],
)

# Each invocation now generates:
#   Span: main-agent (root)
#   └─ Span: grader-subagent (child)
#       └─ Tool calls: any tools the grader used
#   └─ Span: main-agent retry (if rubric failed)
#       └─ Span: grader-subagent (second evaluation)
```

---

## Multi-model grading pattern

Use a different model for grading than for the main task:

| Role | Recommended model | Rationale |
|---|---|---|
| Main agent | `claude-sonnet-4-6` or `claude-opus-4-7` | Best quality for the primary task |
| Grader | `claude-haiku-4-5` | Faster, cheaper; grading is simpler than task completion |

```python
from deepagents import create_deep_agent, RubricMiddleware

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",         # task model
    middleware=[
        RubricMiddleware(
            model="anthropic:claude-haiku-4-5",  # grader model
            max_iterations=2,
        )
    ],
)
```

---

## When not to use RubricMiddleware

| Situation | Better alternative |
|---|---|
| Evaluation is post-hoc (no need to retry) | `llm-evaluation` skill — cheaper, no inline cost |
| Rubric changes rarely (baked-in quality bar) | `system_prompt_suffix` via HarnessProfile — instruct the model directly |
| Strict output structure required | `response_format=` on `create_deep_agent` — structured output is cheaper and more reliable than rubric iteration |
| High-throughput, latency-sensitive requests | `RubricMiddleware` adds at least one extra LLM call per request — evaluate latency impact carefully |

---

## Rubric iteration debugging workflow

When rubric iteration loops or always fails:

1. **Check LangSmith traces** — inspect grader subagent's per-criterion output for each iteration.
2. **Test the criterion in isolation** — run the grader model against a known-good output to confirm the criterion is satisfiable.
3. **Check for contradictory criteria** — two criteria that cannot both be true will loop to exhaustion.
4. **Reduce `max_iterations` during debugging** — set to 1 to see the grader's first-pass feedback without burning retries.
5. **Check `deepagents` version** — `RubricMiddleware` is beta; check the changelog for fixes between versions.

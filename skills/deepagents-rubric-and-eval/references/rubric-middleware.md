# RubricMiddleware Reference — deepagents

> deepagents>=0.6.5 required. Beta — the API may change in future releases.
> Added in v0.6.5 (May 27 2026): "RubricMiddleware for self-evaluated agent iteration (#3529)"

---

## API

```python
from deepagents import RubricMiddleware

RubricMiddleware(
    model: str | BaseChatModel,     # grader model (recommend cheap/fast: claude-haiku-4-5)
    max_iterations: int = 3,        # maximum re-tries before returning regardless of rubric
)
```

---

## How it works

1. The main agent completes its task and produces an output.
2. `RubricMiddleware` dispatches a **dedicated grader subagent** with:
   - The full agent transcript (messages + tool calls + results)
   - The rubric from invocation state
3. The grader subagent evaluates each rubric criterion and returns per-criterion pass/fail feedback.
4. If any criterion fails and `max_iterations` has not been reached:
   - The feedback is injected back to the main agent.
   - The main agent retries with the feedback as context.
5. This loops until all criteria pass OR `max_iterations` is exhausted.
6. The final output is returned to the caller (whether the rubric was satisfied or not).

---

## Rubric format

The rubric is a **newline-delimited checklist** supplied on the invocation state:

```python
rubric = "\n".join([
    "The response is under 200 words.",
    "The response mentions at least 3 specific examples.",
    "The response does not use jargon.",
    "The response ends with a clear call to action.",
])

result = agent.invoke(
    {
        "messages": [...],
        "rubric": rubric,
    },
    config={"configurable": {"thread_id": "my-session"}},
)
```

### Rubric design rules

| Rule | Detail |
|---|---|
| One criterion per line | Each line is evaluated independently |
| Objective criteria | Prefer measurable criteria ("under 200 words") over subjective ones ("sounds professional") |
| Avoid contradictions | Contradictory criteria cause unresolvable iteration |
| No rubric = no grading | If `rubric` is not in the invocation state, `RubricMiddleware` is a complete no-op |

---

## Grader subagent behaviour

The grader:
- **Can call tools** — it has access to the same tool set as the main agent (subject to its own permissions).
- Reasons over the full transcript, not just the final message.
- Returns structured per-criterion feedback (pass/fail + explanation).
- The feedback format is consumed internally by the middleware; the caller sees only the final output.

---

## max_iterations semantics

| Value | Behaviour |
|---|---|
| 1 | Single attempt; no retry regardless of rubric result |
| 2 | One retry on rubric failure |
| 3 (default) | Up to two retries |
| N | Up to N-1 retries |

After `max_iterations` attempts, the agent returns its best output regardless of rubric pass/fail status. There is no error or exception — the caller receives the final output with whatever quality the agent achieved.

**Set `max_iterations` conservatively.** A rubric with an unsatisfiable criterion (e.g., "use exactly 150 words") will loop to exhaustion. Test rubrics for satisfiability before deploying.

---

## Cost implications

Each iteration costs:
- Main agent: another full LLM round-trip (potentially multi-step)
- Grader subagent: one grader model call over the full transcript

With `max_iterations=3` and a consistently failing rubric, you pay for up to 3 main agent runs + 3 grader calls per user request. Use a cheap model for the grader (Haiku 4.5) and keep `max_iterations` at 2–3 for cost control.

---

## Accessing per-criterion feedback in traces

Per-criterion grader feedback appears in LangSmith traces as grader subagent spans. Set `LANGSMITH_API_KEY` and enable tracing to inspect which criteria passed/failed on each iteration:

```bash
LANGSMITH_API_KEY=... LANGSMITH_TRACING=true uv run python your_agent.py
```

The grader's tool calls and reasoning are fully traced — useful for debugging rubric criteria that are consistently failing.

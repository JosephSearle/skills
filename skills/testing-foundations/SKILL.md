---
name: testing-foundations
description: >
  Configure and write tests for agentcraft Python projects: pytest, pytest-asyncio, LangChain/LangGraph
  mock fixtures, and Hypothesis property-based testing. Triggers on: pytest, pytest-asyncio,
  asyncio_mode, async test, fixture, FakeListChatModel, GenericFakeChatModel, InMemorySaver,
  mock LLM, mock checkpointer, property-based, hypothesis, @given, @rule, RuleBasedStateMachine,
  @invariant, @initialize, @precondition, Bundle, coverage, pytest-cov, test isolation,
  asyncio_default_fixture_loop_scope, event_loop, strict-markers, filterwarnings,
  "write tests", "unit test", "integration test", "test async", "test agent", "test graph".
---

## Core Philosophy

Agentcraft tests live in three tiers, enforced by pytest markers:

| Marker | Scope | When to run |
|---|---|---|
| `unit` | Fast, no I/O, mock LLMs | Every commit — seconds |
| `integration` | Real external services | PR gate — minutes |
| `eval` | LLM evaluation (DeepEval / RAGAS) | Schedule or pre-release — minutes to hours |

**Always mock LLMs in unit tests.** `FakeListChatModel` returns deterministic canned responses;
`InMemorySaver` replaces `AsyncPostgresSaver` for graph state. Never call real LLM APIs in
`unit` or Hypothesis tests — cost and non-determinism will ruin both.

Run tests via `uv run pytest` (auto-syncs venv) — never activate the venv manually. See
`developer-experience` for the full `uv` invocation pattern.

---

## Step 1 — Determine Context

| Intent | Signals | Action |
|---|---|---|
| **SETUP** | "configure pytest", "set up testing", "pyproject.toml test config" | Load `references/pytest.md`; emit full config block |
| **MOCK** | "mock LLM", "fake model", "InMemorySaver", "mock checkpointer" | Load `references/mocks.md`; emit fixture code |
| **PROPERTY** | "hypothesis", "property-based", "@given", "state machine" | Load `references/hypothesis.md`; emit Hypothesis patterns |
| **WRITE TESTS** | "write tests for", "add unit tests", "test this function" | Load `references/pytest.md` + `references/mocks.md`; emit full test file |
| **ASYNC** | "async test", "pytest-asyncio", "event loop", "await in test" | Load `references/pytest.md` §async section |

---

## Step 2 — Load References

| Reference file | Load when |
|---|---|
| `references/pytest.md` | Any pytest config, markers, async setup, coverage, parametrize question |
| `references/mocks.md` | Any LangChain/LangGraph mocking, FakeListChatModel, InMemorySaver, tool mocking |
| `references/hypothesis.md` | Any property-based testing, @given, RuleBasedStateMachine, CI profile question |

---

## Step 3 — Apply Patterns

### Standard test structure

```python
# tests/unit/test_my_node.py
import pytest
from langchain_core.language_models.fake import FakeListChatModel
from langgraph.checkpoint.memory import InMemorySaver

from myagent.nodes import my_node


@pytest.fixture
def fake_llm():
    return FakeListChatModel(responses=["mocked response"])


@pytest.fixture
def checkpointer():
    return InMemorySaver()   # fresh instance per test — never shared


@pytest.mark.unit
async def test_my_node_returns_message(fake_llm, checkpointer):
    result = await my_node({"messages": []}, llm=fake_llm)
    assert result["messages"][-1].content == "mocked response"
```

### Which mock fixture?

| Need | Fixture |
|---|---|
| Deterministic LLM responses (list of strings) | `FakeListChatModel(responses=[...])` |
| Full chat model with tool call support | `GenericFakeChatModel` |
| Stateful LangGraph graph in tests | `InMemorySaver()` (function-scoped, one per test) |
| Tool that returns specific output | `unittest.mock.AsyncMock(return_value=...)` |
| Tool that raises | `unittest.mock.AsyncMock(side_effect=SomeException)` |

**Critical**: `InMemorySaver` must be function-scoped. A shared checkpointer causes cross-test state
bleed in stateful graph tests.

### Async test isolation

pytest-asyncio 1.0 removed the `event_loop` fixture. Each `async def test_*` gets a fresh event
loop automatically when `asyncio_mode = "auto"`. For session-scoped async fixtures, use:

```python
@pytest.fixture(scope="session")
async def session_resource():
    ...
```

This requires `asyncio_default_fixture_loop_scope = "session"` in `pyproject.toml` — set it
per test module only if genuinely needed, not globally.

### Hypothesis patterns

```python
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

@given(st.text(min_size=1, max_size=500))
@settings(max_examples=50, deadline=None)
def test_prompt_sanitizer(prompt_text):
    result = sanitize_prompt(prompt_text)
    assert len(result) <= 500
    assert "<script" not in result
```

For multi-step agent workflows, use `RuleBasedStateMachine` (see `references/hypothesis.md`).

---

## Step 4 — Output & Verification

```bash
# Install test group
uv sync --group test

# Run unit tests only
uv run pytest -m unit -x -q

# Run with coverage
uv run pytest -m unit --cov=src --cov-report=term-missing

# Run integration tests
uv run pytest -m integration -x -q

# Run eval tests separately (slow, costly — not in standard CI)
deepeval test run tests/eval/

# Run all (exclude eval)
uv run pytest -m "not eval" -q
```

---

## Reference Files

| File | Domain |
|---|---|
| [references/pytest.md](references/pytest.md) | Full pyproject.toml config block, markers, async setup, coverage, gotchas |
| [references/mocks.md](references/mocks.md) | FakeListChatModel, GenericFakeChatModel, InMemorySaver, tool mock patterns |
| [references/hypothesis.md](references/hypothesis.md) | Strategies, RuleBasedStateMachine, CI profiles, shrinking, LLM-adjacent patterns |

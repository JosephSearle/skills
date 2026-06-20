# Hypothesis Reference

**Version**: ≥ 6.155.0

## Basic property-based test

```python
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from myagent.validators import validate_tool_args


@given(st.dictionaries(
    keys=st.text(min_size=1, max_size=50),
    values=st.one_of(st.text(), st.integers(), st.booleans()),
    max_size=10,
))
@settings(max_examples=200, deadline=None)
def test_validate_tool_args_never_raises(args):
    # Should never raise — must return valid or invalid, not crash
    result = validate_tool_args(args)
    assert isinstance(result, bool)
```

## Strategies for LLM-adjacent types

```python
import hypothesis.strategies as st
from hypothesis_jsonschema import from_schema

# Prompt strings
prompt_text = st.text(min_size=1, max_size=4000)

# Structured tool call arguments against a JSON schema
tool_args = from_schema({
    "type": "object",
    "properties": {
        "query": {"type": "string"},
        "max_results": {"type": "integer", "minimum": 1, "maximum": 20},
    },
    "required": ["query"],
})

# Pydantic models
from hypothesis import given
from hypothesis_pydantic import from_schema as pydantic_from_schema

@given(pydantic_from_schema(MyOutputModel))
def test_output_model_serializes(output):
    json_str = output.model_dump_json()
    assert json_str
```

## RuleBasedStateMachine for multi-step agent workflows

```python
from hypothesis.stateful import (
    RuleBasedStateMachine, Bundle, rule, initialize, invariant, precondition
)
from hypothesis import settings

class AgentWorkflowMachine(RuleBasedStateMachine):
    messages = Bundle("messages")

    @initialize(target=messages)
    def start_conversation(self):
        return []

    @rule(target=messages, msgs=messages, new_msg=st.text(min_size=1, max_size=200))
    def add_user_message(self, msgs, new_msg):
        return msgs + [{"role": "user", "content": new_msg}]

    @precondition(lambda self: len(self.messages_list) > 0)
    @rule(msgs=messages)
    def process_messages(self, msgs):
        # Call agent with mock LLM — never a real API
        result = process_with_fake_llm(msgs)
        assert "output" in result

    @invariant()
    def messages_are_valid(self):
        # Invariant runs after every step
        for m in self.current_messages:
            assert m.get("role") in ("user", "assistant", "tool")


AgentWorkflowMachineTest = AgentWorkflowMachine.TestCase
```

## Settings profiles

```python
from hypothesis import settings, HealthCheck
import os

settings.register_profile("ci",
    max_examples=500,
    derandomize=True,       # reproducible in CI (no random seed)
    deadline=None,          # LLM-adjacent code is slow — disable deadline
    suppress_health_check=[HealthCheck.too_slow],
)

settings.register_profile("dev",
    max_examples=50,
    deadline=2000,          # 2s deadline for fast feedback locally
)

settings.load_profile("ci" if os.getenv("CI") else "dev")
```

Configure in `conftest.py` so profiles load before any test file.

## Key rules for agent testing with Hypothesis

1. **Mock LLMs** — never call real APIs in Hypothesis tests. The framework runs hundreds of examples;
   cost and non-determinism will break shrinking.
2. Use `@precondition` instead of `assume()` in state machines to avoid filtering out most runs.
3. `deadline=None` in CI — agent code is slow and will exceed the default 200ms deadline.
4. Commit `.hypothesis/` database or use `derandomize=True` — the database persists failing examples
   between runs for reproducibility.
5. `@rule` methods in state machines cannot take pytest fixtures or `parametrize` — make state
   machines self-contained with their own setup.

## `stateful_step_count` tuning

```python
@settings(stateful_step_count=20)  # steps per test case (default 50)
class MyMachine(RuleBasedStateMachine):
    ...
```

For complex agent state machines, lower `stateful_step_count` to reduce test runtime in CI.

## Shrinking

Hypothesis automatically shrinks failing examples to the minimal reproducing case. This requires
the system under test to be deterministic for a given input. If your function has side effects
(e.g., writes to DB), ensure they are cleaned up between `@rule` steps.

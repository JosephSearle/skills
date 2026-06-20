# Mock Fixtures Reference

## LangChain LLM mocks

### FakeListChatModel

Returns responses from a list in order. Simplest mock for unit tests.

```python
from langchain_core.language_models.fake import FakeListChatModel

llm = FakeListChatModel(responses=[
    "First response",
    "Second response",
    "Third response",  # raises StopIteration if exhausted
])

result = llm.invoke("any input")
# result.content == "First response"

# Async works too
result = await llm.ainvoke("any input")
```

Use when: testing nodes that call an LLM and you only care about downstream logic,
not the LLM interaction itself.

### GenericFakeChatModel

More flexible: supports tool calling, structured output, and custom message construction.

```python
from langchain_core.language_models.fake import GenericFakeChatModel
from langchain_core.messages import AIMessage, ToolCall

messages = iter([
    AIMessage(
        content="",
        tool_calls=[ToolCall(name="search", args={"query": "test"}, id="1")],
    ),
    AIMessage(content="Final answer based on search results"),
])

llm = GenericFakeChatModel(messages=messages)
```

Use when: testing agents that use tools, or testing structured output parsing.

## LangGraph checkpointer mock

### InMemorySaver (function-scoped — always)

```python
from langgraph.checkpoint.memory import InMemorySaver

@pytest.fixture
def checkpointer():
    return InMemorySaver()   # fresh per test — NEVER share

async def test_graph_persists_state(checkpointer):
    graph = build_graph().compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "test-thread"}}

    await graph.ainvoke({"messages": []}, config=config)

    # Verify state was persisted
    state = await graph.aget_state(config)
    assert state.values["messages"]
```

**Critical rule**: Never use a module-level or session-scoped `InMemorySaver`. Shared checkpointers
cause cross-test state bleed in stateful graph tests.

## Tool mocks

```python
from unittest.mock import AsyncMock, MagicMock, patch

# Mock a tool that returns a value
mock_search = AsyncMock(return_value="Search result content")

# Mock a tool that raises
mock_db = AsyncMock(side_effect=ConnectionError("DB unavailable"))

# Patch a tool at the import location
@patch("myagent.tools.web_search", new_callable=AsyncMock)
async def test_with_patched_tool(mock_search):
    mock_search.return_value = "mocked search result"
    result = await my_node(state)
    mock_search.assert_called_once()
```

## Store mock (LangGraph BaseStore)

```python
from langgraph.store.memory import InMemoryStore

@pytest.fixture
def store():
    return InMemoryStore()

async def test_memory_node(store):
    # InMemoryStore supports the full BaseStore interface
    await store.aput(("user", "123"), "preference", {"theme": "dark"})
    items = await store.asearch(("user", "123"))
    assert items[0].value["theme"] == "dark"
```

## Structuring mock responses for multi-turn tests

```python
@pytest.fixture
def multi_turn_llm():
    return FakeListChatModel(responses=[
        "I need to search for this",   # turn 1: triggers tool call
        "Based on the results: ...",   # turn 2: final answer
    ])
```

## What NOT to mock

- Do not mock the `StateGraph` itself — test with a real compiled graph using `InMemorySaver`.
- Do not mock `RunnableSequence` or LCEL chains — test with `FakeListChatModel` at the LLM level.
- Do not mock `InMemorySaver` — it IS the in-memory replacement for `AsyncPostgresSaver`.

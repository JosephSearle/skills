# create_agent Reference

> Content absorbed from the `langchain-agents` skill (eliminated in v2 skill architecture).
> `create_agent` is now the canonical path in `langchain-core`.

## Overview

`create_agent` is the single canonical entry point for any standard tool-calling agent in
LangChain v1.0+. It returns a compiled LangGraph `CompiledStateGraph`. Reach for a hand-built
`StateGraph` only when: parallel fan-out, supervisor/worker topologies, or deterministic
multi-step pipelines actively conflict with the loop abstraction.

## Signature

```python
from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool

agent = create_agent(
    model="anthropic:claude-sonnet-4-6",   # str shorthand or BaseChatModel instance
    tools=[my_tool, another_tool],          # list[@tool fns, BaseTool instances, callables]
    *,
    checkpointer=None,                      # None = stateless; InMemorySaver or AsyncPostgresSaver
    response_format=None,                   # None | type[T] | ProviderStrategy | ToolStrategy
    system_prompt=None,                     # str or ChatPromptTemplate
    middleware=None,                        # list[AgentMiddleware]
    state_schema=None,                      # TypedDict subclass of AgentState
)
```

## Model param

| Input | Use | Constraint |
|---|---|---|
| String shorthand | `"anthropic:claude-sonnet-4-6"` | Parsed via `init_chat_model` |
| `BaseChatModel` | `ChatAnthropic(...)` — full config control | Do NOT call `.bind_tools()` before passing when `response_format` is also set |
| Configurable | `init_chat_model(..., configurable_fields=["model"])` | Allows per-invocation model overrides |

## Tools param

Accepts: `@tool`-decorated functions, plain callables with type hints and docstrings, `BaseTool`
instances, and provider `dict` tools. `ToolNode` instances are **not** accepted (v0 artifact).
An empty list produces a model-only agent with no tool loop.

## response_format strategies

| Scenario | Strategy | Notes |
|---|---|---|
| Provider supports `json_schema` | `response_format=MySchema` (auto) | Auto-selects `ProviderStrategy` |
| Hard guarantees, OpenAI, strict schema | `ProviderStrategy(MySchema, strict=True)` | Strict JSON schema mode |
| Any tool-calling model | `ToolStrategy(MySchema)` | Artificial tool; sets `tool_choice="any"` |
| Anthropic + extended thinking | Use `include_raw=True` + manual parse | `ToolStrategy` conflicts with thinking |
| No structured output | `response_format=None` (default) | Omit entirely |

Result always in `result["structured_response"]`.

## Middleware ordering

Place in list from outermost (first) to innermost (last):
1. `ModelCallLimitMiddleware`, `PIIMiddleware` — guardrails/limits
2. `SummarizationMiddleware`, `AnthropicPromptCachingMiddleware` — context manipulation
3. `TodoListMiddleware`, `LLMToolSelectorMiddleware` — augmentation
4. `ModelRetryMiddleware`, `ToolRetryMiddleware`, `ModelFallbackMiddleware` — reliability
5. `HumanInTheLoopMiddleware` — HITL (last; requires checkpointer)

## Thread persistence

```python
from langgraph.checkpoint.memory import InMemorySaver     # tests only
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver  # production

# Production agent with persistence
agent = create_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[...],
    checkpointer=AsyncPostgresSaver(conn_string=os.environ["DB_URI"]),
)

# Invoke with thread ID
result = await agent.ainvoke(
    {"messages": [{"role": "user", "content": "Hello"}]},
    config={"configurable": {"thread_id": "user-123"}},
)
```

## Basic example

```python
from langchain.agents import create_agent
from langchain_core.tools import tool

@tool
def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

agent = create_agent(
    model="anthropic:claude-haiku-4-5-20251001",
    tools=[add_numbers],
)

result = agent.invoke({"messages": [{"role": "user", "content": "What is 3 + 4?"}]})
print(result["messages"][-1].content)
```

## Migration from AgentExecutor

See `references/migration.md` for full side-by-side mapping. Quick summary:

| Old | New |
|---|---|
| `AgentExecutor(agent=..., tools=...)` | `create_agent(model=..., tools=...)` |
| `create_react_agent(llm, tools, prompt)` | `create_agent(model, tools, system_prompt=prompt)` |
| `agent.run("question")` | `agent.invoke({"messages": [{"role": "user", "content": "question"}]})` |
| `AgentExecutor(handle_parsing_errors=True)` | Built-in; no config needed |
| `memory=ConversationBufferMemory()` | `checkpointer=InMemorySaver()` |

Custom state schemas MUST be `TypedDict` subclasses of `AgentState` — Pydantic models and
dataclasses are not supported in v1.

# Migration Reference — AgentExecutor / create_react_agent → create_agent

## Status of deprecated APIs

| API | Status | Availability |
|---|---|---|
| `AgentExecutor` | Maintenance mode; no new features | `langchain-classic` package; not in `langchain` v1 |
| `langgraph.prebuilt.create_react_agent` | Deprecated in LangChain v1.0; removed in v2.0 | Available in `langchain` 1.x for migration window |
| `langchain.agents.create_agent` | **Stable** — no breaking changes until v2.0 | `langchain>=1.0.0` |

Install the target package:

```bash
uv add langchain langchain-anthropic langgraph
# If you still need legacy chains/retrievers during the migration window:
uv add langchain-classic
```

---

## Full Parameter Mapping Table

| v0 parameter / pattern | v1 `create_agent` equivalent | Notes |
|---|---|---|
| `from langgraph.prebuilt import create_react_agent` | `from langchain.agents import create_agent` | Direct import swap |
| `AgentExecutor(agent, tools, ...)` | `create_agent(model, tools, ...)` | `create_agent` returns a `CompiledStateGraph` directly; no executor wrapper needed |
| `prompt=ChatPromptTemplate.from_messages([...])` | `system_prompt="..."` (str or `SystemMessage`) | Static string/message only; dynamic prompts use `@dynamic_prompt` middleware |
| `pre_model_hook=fn` | `middleware=[...] with before_model(...)` | See migration example below |
| `post_model_hook=fn` | `middleware=[...] with after_model(...)` | See migration example below |
| `return_intermediate_steps=True` | Inspect `result["messages"]` | All tool calls and `ToolMessage`s are in the messages list |
| `max_iterations=N` | `ModelCallLimitMiddleware(run_limit=N)` or `config={"recursion_limit": N}` | Middleware preferred; `recursion_limit` in config also works |
| `max_execution_time=N` | Wrap invocation with `asyncio.timeout(N)` | No direct parameter; LangGraph config has no wall-clock timeout |
| `early_stopping_method="generate"` | Custom `before_model` returning `{"jump_to": "end", "messages": [...]}` | Requires `@hook_config(can_jump_to=["end"])` on the hook |
| `ConversationBufferMemory(...)` | `checkpointer=InMemorySaver()` + `thread_id` in config | See persistence migration example |
| `handle_parsing_errors=True` | `ToolRetryMiddleware(on_failure="return_error")` | Error message returned as `ToolMessage` for model self-correction |
| `handle_parsing_errors=fn` | Custom `wrap_tool_call` catching exceptions | Return `ToolMessage(content=fn(exc))` |
| Custom output parser | `response_format=MySchema` | `ProviderStrategy` or `ToolStrategy`; see structured output section |
| `config["configurable"]` static context | `context=` arg + `context_schema=` | `configurable` still works for backwards compatibility |
| Streaming node named `"agent"` | Node is now named `"model"` | Update any `stream_mode="updates"` filters on node name |
| `AgentExecutor.invoke({"input": "..."})["output"]` | `agent.invoke({"messages": [...]})["messages"][-1].content` | Input/output format changed |
| `version="v1"` / `version="v2"` param on `create_react_agent` | Removed | v1 `create_agent` is the v2 behaviour as default |
| `create_react_agent(model, tools, state_schema=PydanticModel)` | `create_agent(model, tools, state_schema=TypedDictSubclass)` | Pydantic and dataclasses not accepted in v1 |
| `create_react_agent(..., messages_modifier=fn)` | `before_model` middleware hook | Exact equivalent |

---

## Side-by-Side Migration Examples

### 1. Basic agent — import and invocation

**v0 (AgentExecutor):**
```python
from langchain.agents import AgentExecutor, create_react_agent
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get weather for a city."""
    return f"Sunny, 22°C in {city}"


model = ChatAnthropic(model="claude-3-5-sonnet-20240620")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful weather assistant."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])
agent = create_react_agent(model, [get_weather], prompt)
executor = AgentExecutor(agent=agent, tools=[get_weather])

result = executor.invoke({"input": "What's the weather in Paris?"})
print(result["output"])
```

**v1 (create_agent):**
```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain_core.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get weather for a city."""
    return f"Sunny, 22°C in {city}"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[get_weather],
        system_prompt="You are a helpful weather assistant.",
    )
    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "What's the weather in Paris?"}]
    })
    print(result["messages"][-1].content)


asyncio.run(main())
```

---

### 2. Static prompt → `system_prompt`

**v0:**
```python
from langgraph.prebuilt import create_react_agent
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(model="claude-3-5-sonnet-20240620")
agent = create_react_agent(
    model,
    tools=[],
    prompt="You are a concise assistant. Answer in one sentence.",
)
```

**v1:**
```python
from langchain.agents import create_agent

agent = create_agent(
    "claude-sonnet-4-5-20250929",
    tools=[],
    system_prompt="You are a concise assistant. Answer in one sentence.",
)
```

---

### 3. Dynamic prompt (messages_modifier / pre_model_hook) → `before_model` middleware

**v0:**
```python
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import SystemMessage
from datetime import date

def inject_date(state):
    """Prepend a system message with today's date."""
    today = date.today().isoformat()
    return [SystemMessage(content=f"Today is {today}.")] + state["messages"]

agent = create_react_agent(
    "claude-3-5-sonnet-20240620",
    tools=[],
    messages_modifier=inject_date,   # or pre_model_hook=inject_date
)
```

**v1:**
```python
from __future__ import annotations
from datetime import date
from typing import Any
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, AgentState, ModelRequest, ModelResponse
from langchain_core.messages import SystemMessage
from langgraph.runtime import Runtime


class DateInjectionMiddleware(AgentMiddleware[AgentState]):
    """Inject today's date into the system prompt before every model call."""

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler,
    ) -> ModelResponse:
        today = date.today().isoformat()
        base_content = (
            list(request.system_message.content)
            if request.system_message
            else []
        )
        base_content.append({"type": "text", "text": f"Today is {today}."})
        return handler(
            request.override(system_message=SystemMessage(content=base_content))
        )

    async def awrap_model_call(self, request, handler) -> ModelResponse:
        return self.wrap_model_call(request, handler)


agent = create_agent(
    "claude-sonnet-4-5-20250929",
    tools=[],
    middleware=[DateInjectionMiddleware()],
)
```

---

### 4. `max_iterations` → `ModelCallLimitMiddleware`

**v0:**
```python
from langchain.agents import AgentExecutor, create_react_agent
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(model="claude-3-5-sonnet-20240620")
agent = create_react_agent(model, tools=[...])
executor = AgentExecutor(agent=agent, tools=[...], max_iterations=5)
```

**v1:**
```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_core.tools import tool


@tool
def search(query: str) -> str:
    """Search the web."""
    return f"Results for {query}"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[search],
        middleware=[
            ModelCallLimitMiddleware(run_limit=5, exit_behavior="end")
        ],
    )
    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "Research climate change and summarise"}]
    })
    print(result["messages"][-1].content)


asyncio.run(main())
```

**Alternative:** Pass `recursion_limit` at invocation time (applies to the underlying LangGraph loop):
```python
result = await agent.ainvoke(
    {"messages": [...]},
    config={"recursion_limit": 10},
)
```

---

### 5. `ConversationBufferMemory` → `checkpointer`

**v0:**
```python
from langchain.memory import ConversationBufferMemory
from langchain.agents import AgentExecutor, create_react_agent
from langchain_anthropic import ChatAnthropic

memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
model = ChatAnthropic(model="claude-3-5-sonnet-20240620")
agent = create_react_agent(model, tools=[], prompt=prompt)
executor = AgentExecutor(agent=agent, tools=[], memory=memory)

executor.invoke({"input": "Hi, I'm Alice"})
executor.invoke({"input": "What's my name?"})  # remembers via ConversationBufferMemory
```

**v1:**
```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[],
        checkpointer=InMemorySaver(),
    )

    thread_cfg = {"configurable": {"thread_id": "user-alice"}}

    await agent.ainvoke(
        {"messages": [{"role": "user", "content": "Hi, I'm Alice"}]},
        config=thread_cfg,
    )
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "What's my name?"}]},
        config=thread_cfg,
    )
    # Remembers Alice via add_messages reducer + checkpointer
    print(result["messages"][-1].content)


asyncio.run(main())
```

For production persistence, swap `InMemorySaver` for `AsyncPostgresSaver` or `AsyncSqliteSaver`.

---

### 6. Custom output parser → `response_format`

**v0:**
```python
from langchain.output_parsers import PydanticOutputParser
from langchain.agents import AgentExecutor, create_react_agent
from pydantic import BaseModel

class Summary(BaseModel):
    headline: str
    key_points: list[str]
    sentiment: str

parser = PydanticOutputParser(pydantic_object=Summary)
# ... wired into the agent prompt + output chain
```

**v1:**
```python
from __future__ import annotations
import asyncio
from pydantic import BaseModel
from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy


class Summary(BaseModel):
    headline: str
    key_points: list[str]
    sentiment: str


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[],
        response_format=ProviderStrategy(Summary),
    )

    result = await agent.ainvoke({
        "messages": [{
            "role": "user",
            "content": "Summarise: The new battery technology cuts EV costs by 40%.",
        }]
    })

    summary: Summary = result["structured_response"]
    print(f"Headline: {summary.headline}")
    print(f"Key points: {summary.key_points}")
    print(f"Sentiment: {summary.sentiment}")


asyncio.run(main())
```

---

### 7. Custom state schema — TypedDict only

**v0 (accepted Pydantic/dataclasses):**
```python
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel
from typing import Annotated
from langgraph.graph.message import add_messages

class MyState(BaseModel):  # Pydantic — worked in v0
    messages: Annotated[list, add_messages]
    user_id: str = ""

agent = create_react_agent("claude-...", tools=[], state_schema=MyState)  # v0 only
```

**v1 (TypedDict only):**
```python
from __future__ import annotations
from typing import NotRequired
from typing_extensions import TypedDict
from langchain.agents import create_agent
from langchain.agents.middleware import AgentState


class MyState(AgentState):   # MUST be TypedDict subclass of AgentState
    user_id: NotRequired[str]
    session_context: NotRequired[dict[str, str]]


agent = create_agent(
    "claude-sonnet-4-5-20250929",
    tools=[],
    state_schema=MyState,
)

# Pass custom fields in the initial state
result = agent.invoke({
    "messages": [{"role": "user", "content": "Help me"}],
    "user_id": "usr-123",
    "session_context": {"locale": "en-US", "plan": "pro"},
})
```

> **⚠️ v1.0:** Pydantic `BaseModel` and `@dataclass` are NOT supported as `state_schema` in v1.
> Validate data inside middleware `before_model` / `before_agent` hooks.

---

### 8. `return_intermediate_steps` → inspect `result["messages"]`

**v0:**
```python
executor = AgentExecutor(agent=agent, tools=[...], return_intermediate_steps=True)
result = executor.invoke({"input": "..."})
for action, observation in result["intermediate_steps"]:
    print(f"Tool: {action.tool}, Input: {action.tool_input}")
    print(f"Output: {observation}")
```

**v1:**
```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain_core.messages import AIMessage, ToolMessage


async def main() -> None:
    agent = create_agent("claude-sonnet-4-5-20250929", tools=[...])
    result = await agent.ainvoke({"messages": [{"role": "user", "content": "..."}]})

    # All tool calls and results are in the messages list
    for msg in result["messages"]:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                print(f"Tool: {tc['name']}, Input: {tc['args']}")
        elif isinstance(msg, ToolMessage):
            print(f"Tool result: {msg.content}")


asyncio.run(main())
```

---

### 9. Wrapping legacy `AgentExecutor` as a migration bridge node

For incremental migration — keeps the legacy executor running inside a v1 `StateGraph` until it
can be replaced:

```python
from __future__ import annotations
from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AIMessage, AnyMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages


class BridgeState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


def legacy_executor_node(state: BridgeState) -> dict:
    """Wrap a legacy AgentExecutor as a LangGraph node."""
    user_input = state["messages"][-1].content
    output = legacy_agent_executor.invoke({"input": user_input})["output"]
    return {"messages": [AIMessage(content=output)]}


builder = StateGraph(BridgeState)
builder.add_node("legacy", legacy_executor_node)
builder.add_edge(START, "legacy")
builder.add_edge("legacy", END)

bridge_graph = builder.compile()
```

---

## Migration Gotchas

| Gotcha | Detail | Resolution |
|---|---|---|
| Node name `"agent"` → `"model"` | Streaming filters on node name break silently | Update any `stream_mode="updates"` code filtering on `"agent"` to use `"model"` |
| Custom state schema type enforcement | v0 accepted Pydantic/dataclasses; v1 rejects them at construction time | Convert to `TypedDict` subclassing `AgentState` |
| `pre_model_hook`/`post_model_hook` removed | v0 `create_react_agent` had these params; v1 `create_agent` does not | Convert to `AgentMiddleware` with `before_model`/`after_model` hooks |
| `messages_modifier` removed | v0 convenience param for modifying messages before model call | Use `wrap_model_call` or `before_model` middleware |
| `prompt` template removed | v1 does not accept `ChatPromptTemplate` | Flatten to `system_prompt=` string; dynamic logic in middleware |
| `ToolNode` in tools | v0 accepted `ToolNode`; v1 raises `ValueError` | Remove `ToolNode`; pass raw `BaseTool` / `@tool` functions |
| Output format changed | v0: `result["output"]` string; v1: `result["messages"][-1].content` | Update all callers |
| `input` key removed | v0 `invoke({"input": "..."})` ; v1 `invoke({"messages": [...]})` | Wrap old string inputs: `{"messages": [{"role": "user", "content": text}]}` |
| History rewriting via hook | v0 `pre_model_hook` could rewrite full history; v1 `before_model` merges via reducers | Use `wrap_model_call` with `request.override(messages=new_list)` for full rewrites |

---

## Migration Checklist

```
[ ] Swap import: from langgraph.prebuilt import create_react_agent
                 → from langchain.agents import create_agent
[ ] Replace AgentExecutor wrapper — create_agent returns the runnable directly
[ ] Rename prompt= → system_prompt= (static str/SystemMessage)
[ ] Convert dynamic prompts / messages_modifier / pre_model_hook → middleware
[ ] Remove ToolNode instances from tools list
[ ] Replace max_iterations= → ModelCallLimitMiddleware(run_limit=N)
[ ] Replace ConversationBufferMemory → checkpointer= + thread_id in config
[ ] Replace custom output parser → response_format=
[ ] Replace state_schema=PydanticModel → state_schema=TypedDictSubclassOfAgentState
[ ] Update invoke() call signature: {"input": "..."} → {"messages": [...]}
[ ] Update result access: result["output"] → result["messages"][-1].content
[ ] Update streaming node name filters: "agent" → "model"
[ ] Verify return_intermediate_steps users now inspect result["messages"] directly
```

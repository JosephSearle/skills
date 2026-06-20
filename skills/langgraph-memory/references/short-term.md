# Short-Term Memory Reference — trim_messages, SummarizationNode, RemoveMessage

## Context Overflow: Hard Error, Not Silent Truncation

LangGraph **never** trims accumulated message history automatically. When the serialized
message list plus tool schemas exceeds the model's context window, the provider returns a
hard error — for example OpenAI's `BadRequestError` with `'code': 'context_length_exceeded'`
(HTTP 400). This is not a soft degradation; the entire invocation fails.

A common production trap: a tool node appends large `ToolMessage` payloads to state on every
turn, the checkpointer faithfully replays all of them, and the graph runs successfully for
dozens of turns until one conversation crosses the model limit and every subsequent invocation
fails permanently for that thread.

> **⚠️ langgraph issue #3717:** Documents this exact failure mode — accumulated `ToolMessage`
> history silently grows until `context_length_exceeded` terminates the thread. The fix is
> always an explicit trim or summarise step before the model call. There is no configuration
> flag to enable automatic truncation.

**Rule:** Every production graph must include `trim_messages` or `SummarizationNode` before
the model node. Treat the absence of a trim step as a latent outage.

---

## `add_messages` Reducer: Deduplication and Removal

The `add_messages` reducer (used as a field annotation on graph state) **appends** new messages
to the existing list rather than overwriting it. With a checkpointer, each invocation under the
same `thread_id` loads the prior checkpoint, appends, and re-persists.

`add_messages` has two additional behaviours beyond simple append:

**Deduplication by id:** If a new message carries the same `id` as an existing message, the
new message replaces the old one in-place. This is how you correct an AI response without
appending a duplicate.

**Removal via `RemoveMessage`:** A `RemoveMessage(id=target_id)` in the update list instructs
the reducer to delete the message with that id. This is the only in-band way to shrink history.

```python
from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage, RemoveMessage
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.graph.message import add_messages
from langgraph.checkpoint.postgres import PostgresSaver

# MessagesState already defines:
#   messages: Annotated[list[AnyMessage], add_messages]
# Extend it with any extra fields:
class State(MessagesState):
    context: dict  # holds RunningSummary when SummarizationNode is in use

DB_URI = "postgresql://user:pass@localhost:5432/mydb?sslmode=disable"

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()  # run once at deploy time; idempotent
    graph = builder.compile(checkpointer=checkpointer)
    cfg = {"configurable": {"thread_id": "user-42:session-1"}}

    # Turn 1 — state is created fresh
    graph.invoke({"messages": [{"role": "user", "content": "My name is Alice."}]}, cfg)

    # Turn 2 — checkpointer loads turn 1 state; both messages are visible
    graph.invoke({"messages": [{"role": "user", "content": "What is my name?"}]}, cfg)
```

> **⚠️ langgraph issue #5112:** `RemoveMessage` is a no-op when the target `id` does not
> exactly match what is persisted in the checkpoint. Always source the `id` from the live
> state (`graph.get_state(cfg).values["messages"][-1].id`) rather than constructing it
> from scratch.

---

## `RemoveMessage` — Full Patterns

### Remove from a node

```python
from langchain_core.messages import RemoveMessage
from langgraph.graph import StateGraph, START, MessagesState

class State(MessagesState):
    pass

def prune_all_but_last(state: State) -> dict:
    """Keep only the most recent message; remove everything else."""
    to_remove = [RemoveMessage(id=m.id) for m in state["messages"][:-1]]
    return {"messages": to_remove}

def prune_tool_messages(state: State) -> dict:
    """Remove all ToolMessage payloads to reclaim tokens after a tool-heavy turn."""
    from langchain_core.messages import ToolMessage
    to_remove = [
        RemoveMessage(id=m.id)
        for m in state["messages"]
        if isinstance(m, ToolMessage)
    ]
    return {"messages": to_remove}
```

### Remove externally via `update_state`

```python
from langchain_core.messages import RemoveMessage

cfg = {"configurable": {"thread_id": "user-42:session-1"}}
current = graph.get_state(cfg)

# Delete the last AI message (e.g., after a bad tool call)
bad_message = current.values["messages"][-1]
graph.update_state(cfg, {"messages": [RemoveMessage(id=bad_message.id)]})
```

---

## `trim_messages` — Full API and Typed Examples

`trim_messages` from `langchain_core.messages` reduces a message list to fit within a token
or message budget. It does **not** call any LLM — it is a pure, synchronous, deterministic
function.

### Parameter reference

| Parameter | Type | Default | Description |
|---|---|---|---|
| `messages` | `list[AnyMessage]` | required | The full history to trim |
| `max_tokens` | `int` | required | Budget ceiling (tokens or count depending on `token_counter`) |
| `strategy` | `Literal["last", "first"]` | `"last"` | `"last"` keeps most recent; `"first"` keeps oldest |
| `token_counter` | `Callable[[list[AnyMessage]], int] \| BaseChatModel` | required | Pass a model for exact counts, `count_tokens_approximately` for fast estimates, or `len` to count messages |
| `allow_partial` | `bool` | `False` | If `True`, split a message body so the tail fits; if `False`, drop the whole message |
| `include_system` | `bool` | `False` | Keep a leading `SystemMessage` regardless of budget (only with `strategy="last"`) |
| `start_on` | `str \| type \| None` | `None` | After trimming, drop everything before the first occurrence of this message type (only with `strategy="last"`, applied after token trim) |
| `end_on` | `str \| type \| None` | `None` | After trimming, drop everything after the last occurrence of this message type |

### Production example — token-budget trim

```python
from langchain_core.messages import AnyMessage, SystemMessage
from langchain_core.messages import trim_messages
from langchain_core.messages.utils import count_tokens_approximately
from langgraph.graph import StateGraph, START, MessagesState

class State(MessagesState):
    llm_input_messages: list[AnyMessage]  # separate key; do not overwrite canonical history

def pre_model_trim(state: State) -> dict:
    """Trim to 4 000-token budget before passing to the model."""
    trimmed = trim_messages(
        state["messages"],
        max_tokens=4_000,
        strategy="last",
        token_counter=count_tokens_approximately,
        include_system=True,   # keep system prompt
        start_on="human",      # ensure trimmed list starts with Human (valid model input)
        allow_partial=False,
    )
    return {"llm_input_messages": trimmed}
```

### Production example — message-count window (emulates `ConversationBufferWindowMemory`)

```python
from langchain_core.messages import trim_messages

def last_k_messages(state: State, k: int = 20) -> dict:
    """Keep the most recent k messages (count-based, no LLM)."""
    trimmed = trim_messages(
        state["messages"],
        max_tokens=k,
        strategy="last",
        token_counter=len,     # token_counter=len → max_tokens is message count
        include_system=True,
        start_on="human",
        allow_partial=False,
    )
    return {"llm_input_messages": trimmed}
```

> **⚠️ langchain issue #26895:** `trim_messages` with `strategy="last"`, `include_system=True`,
> and an **empty** input list raised `IndexError` in some versions. Guard with
> `if not state["messages"]: return {"llm_input_messages": []}` before calling.

### Rules of thumb

- Always use `start_on="human"` with `strategy="last"` so the trimmed list is a valid model
  input (must start with Human message, or System then Human).
- A `ToolMessage` must follow its triggering `AIMessage` — `trim_messages` preserves this
  pairing only when the pair fits within the budget as a unit.
- Write the trimmed result to a **separate state key** (e.g. `llm_input_messages`) to decouple
  the view from canonical history.

---

## `SummarizationNode` — Full API and Integration

`SummarizationNode` from `langmem.short_term` is a LangGraph node (subclass of
`RunnableCallable`) that summarises the message prefix with an LLM once accumulated tokens
exceed a threshold. It replaces the summarised prefix with a single `AIMessage` summary and
keeps the unsummarised tail verbatim.

### Full constructor signature

```python
from langmem.short_term import SummarizationNode

SummarizationNode(
    *,
    model: LanguageModelLike,                          # the model to summarise with
    max_tokens: int,                                    # cap on final returned output
    max_tokens_before_summary: int | None = None,       # trigger threshold; defaults to max_tokens
    max_summary_tokens: int = 256,                      # budget reservation for the summary (NOT an LLM cap)
    token_counter: TokenCounter = count_tokens_approximately,
    initial_summary_prompt: ChatPromptTemplate = ...,   # first summarisation pass
    existing_summary_prompt: ChatPromptTemplate = ...,  # subsequent passes (rolling)
    final_prompt: ChatPromptTemplate = ...,             # formats the final output message
    input_messages_key: str = "messages",               # reads from this state key
    output_messages_key: str = "summarized_messages",   # writes to this separate state key
    name: str = "summarization",
)
```

### Critical semantics

- **Output key differs from input key by default.** `SummarizationNode` writes to
  `state["summarized_messages"]`, not `state["messages"]`. The canonical message history is
  preserved; the summarised view is a separate key consumed by the model node. Set them equal
  **only** if you want to overwrite history (lossy, irreversible without the checkpoint).
- **`max_summary_tokens` is a budget reservation, not an LLM output cap.** To actually limit
  summary length, pass `model.bind(max_tokens=N)` as the `model` argument.
- **`state["context"]`** must be typed as `dict[str, RunningSummary]` and present in graph
  state. The node reads and writes the running summary here so it accumulates across turns.
- **Tool-call pairing:** the node will not split an `AIMessage` with tool calls from its
  corresponding `ToolMessage`s — the pair is always summarised together.
- **Processing order:** oldest → newest. Once cumulative tokens reach
  `max_tokens_before_summary`, the prefix is summarised (excluding any leading `SystemMessage`).

### Full StateGraph integration

```python
from __future__ import annotations

from typing import Any
from typing_extensions import TypedDict

from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langchain_core.messages.utils import count_tokens_approximately
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph, START, MessagesState
from langmem.short_term import SummarizationNode, RunningSummary

# --- Models ---
main_model = init_chat_model("anthropic:claude-3-7-sonnet-latest")
# Enforce summary length at the model level, not via max_summary_tokens
summarisation_model = main_model.bind(max_tokens=128)

# --- State ---
class State(MessagesState):
    # RunningSummary holds: summary str, summarized_message_ids, last_summarized_message_id
    context: dict[str, RunningSummary]

class LLMInputState(TypedDict):
    """Private input state for the model node; isolates summarised view from canonical state."""
    summarized_messages: list[AnyMessage]
    context: dict[str, RunningSummary]

# --- Nodes ---
summarisation_node = SummarizationNode(
    token_counter=count_tokens_approximately,
    model=summarisation_model,
    max_tokens=4_096,                      # cap on final output to model
    max_tokens_before_summary=3_500,       # trigger: summarise when prefix exceeds this
    max_summary_tokens=128,                # budget reservation (not LLM cap)
)

def call_model(state: LLMInputState) -> dict:
    # Reads from summarized_messages, NOT messages
    response = main_model.invoke(state["summarized_messages"])
    return {"messages": [response]}

# --- Graph ---
builder = StateGraph(State)
builder.add_node("summarize", summarisation_node)
builder.add_node("call_model", call_model)
builder.add_edge(START, "summarize")
builder.add_edge("summarize", "call_model")

DB_URI = "postgresql://user:pass@localhost:5432/mydb"
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
```

### Known bugs

> **⚠️ langmem issue #126:** Parallel tool calls can break summarisation — the node does not
> handle the case where multiple `ToolMessage`s correspond to a single `AIMessage` with
> parallel tool calls.

> **⚠️ langmem issue #111:** When `SummarizationNode` is used as a `pre_model_hook` and
> invoked after a tool call, it has been observed to drop the `HumanMessage`, leaving only
> the `SystemMessage`. The LLM invocation then fails with a validation error. Test this
> path explicitly in your graph.

> **⚠️ langgraph issue #5179:** A `KeyError` was reported when `SummarizationNode` runs in
> certain graph configurations. Validate your specific graph topology before shipping.

### Deferred execution pattern

`SummarizationNode` is synchronous on the main path — it adds an LLM call (reported at
~10–15 s for large histories) before the agent responds. To avoid blocking the user, run
summarisation off the hot path:

```python
import asyncio
from langchain_core.messages import AnyMessage
from langmem.short_term import SummarizationNode, RunningSummary

async def background_summarise(
    messages: list[AnyMessage],
    context: dict[str, RunningSummary],
    node: SummarizationNode,
    checkpointer,
    thread_id: str,
) -> None:
    """
    Run summarisation after the user has received a response.
    Persist the result so the next turn loads a compact history.
    """
    result = await asyncio.to_thread(
        node.invoke,
        {"messages": messages, "context": context},
    )
    # Persist the updated context back to the checkpointer
    # so the next invocation starts with the summarised state.
    cfg = {"configurable": {"thread_id": thread_id}}
    checkpointer.put(
        cfg,
        result,  # updated state delta with context and summarized_messages
        {},
        {},
    )
```

---

## Trim vs Summarise Decision Table

| Strategy | Mechanism | LLM cost | Fidelity | Use when |
|---|---|---|---|---|
| Window trim | `trim_messages(strategy="last")` | None | Lossy — drops oldest turns | Recent context suffices; cost-sensitive; independent turns |
| Keep-first trim | `trim_messages(strategy="first")` | None | Lossy — drops newest | Preserving setup context (rare) |
| Summarise prefix | `SummarizationNode` | One LLM call per summarisation pass | Lossy-but-coherent gist | Long multi-step sessions; support workflows; technical context carries forward |
| Hybrid | `SummarizationNode` prefix + `trim_messages` tail | Amortised LLM cost | Best | Production assistants with very long histories and cost tolerance |

---

## Thread Lifecycle

### Creating and continuing threads

```python
import uuid

# Deterministic thread id — avoids a separate thread registry
def make_thread_id(user_id: str, session_id: str) -> str:
    return f"{user_id}:{session_id}"

# Continue an existing thread (loads prior checkpoint automatically)
cfg_existing = {"configurable": {"thread_id": "user-42:session-1"}}
graph.invoke({"messages": [{"role": "user", "content": "Follow up question"}]}, cfg_existing)

# New thread — clean slate for short-term state; Store (long-term) is unaffected
cfg_new = {"configurable": {"thread_id": make_thread_id("user-42", str(uuid.uuid4()))}}
graph.invoke({"messages": [{"role": "user", "content": "New conversation"}]}, cfg_new)
```

A returning user with a new `thread_id` starts a fresh short-term history but still has
access to all their long-term Store entries (preferences, past facts).

### Deleting threads

```python
from langgraph.checkpoint.postgres import PostgresSaver

# Delete all checkpoints for a thread (local/embedded checkpointer)
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.delete_thread("user-42:session-1")

# Via LangGraph Platform SDK (async)
import asyncio
from langgraph_sdk import get_client

async def delete_thread(thread_id: str) -> None:
    client = get_client(url="http://localhost:2024")
    await client.threads.delete(thread_id)

asyncio.run(delete_thread("user-42:session-1"))
```

For GDPR deletion: call `delete_thread` for every `thread_id` belonging to the user (maintain
a mapping of `user_id → [thread_ids]`), then separately sweep the Store namespace
(see `references/long-term-store.md`).

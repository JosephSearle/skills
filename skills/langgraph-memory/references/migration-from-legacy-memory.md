# Migration from Legacy LangChain Memory

## Scope and Timeline

All legacy LangChain memory classes were **deprecated in LangChain v0.3.1** and **removed
in LangChain v1.0.0**. They were designed for single-conversation, in-process use and
predate checkpointers, tool calling, and the Store. None of them support multi-user access,
persistence across restarts, or cross-thread facts.

| Legacy class | Package | Status | LangGraph replacement |
|---|---|---|---|
| `ConversationBufferMemory` | `langchain.memory` | Removed in v1.0.0 | `PostgresSaver` + `thread_id` |
| `ConversationSummaryMemory` | `langchain.memory` | Removed in v1.0.0 | `SummarizationNode` |
| `ConversationBufferWindowMemory` | `langchain.memory` | Removed in v1.0.0 | `trim_messages(strategy="last")` |
| `VectorStoreRetrieverMemory` | `langchain.memory` | Removed in v1.0.0 | LangMem search tool or `store.search()` |
| `ConversationEntityMemory` / `ZepMemory` | `langchain.memory` / `langchain-community` | Removed / broken | LangMem semantic memory; `ZepCloudMemory` |

---

## 1. `ConversationBufferMemory` → `PostgresSaver` + `thread_id`

`ConversationBufferMemory` held all messages in RAM for a single chain invocation. The
LangGraph equivalent is a checkpointer — each `thread_id` is a persistent, independently
resumable conversation.

### Old (LangChain LCEL, pre-v0.3.1)

```python
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
memory = ConversationBufferMemory(return_messages=True)
chain = ConversationChain(llm=llm, memory=memory)

chain.predict(input="My name is Alice.")
chain.predict(input="What is my name?")
# Memory lives in the process; dies on restart; not shareable across requests
```

### New (LangGraph + PostgresSaver)

```python
from __future__ import annotations

from typing_extensions import TypedDict
from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.graph.message import add_messages
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://user:pass@localhost:5432/mydb"

llm = init_chat_model("openai:gpt-4o")

class State(MessagesState):
    pass  # messages: Annotated[list[AnyMessage], add_messages] inherited

def call_model(state: State) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

builder = StateGraph(State)
builder.add_node("model", call_model)
builder.add_edge(START, "model")

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()  # run once at deploy time
    graph = builder.compile(checkpointer=checkpointer)

    # Deterministic thread id — one conversation per user/session pair
    cfg = {"configurable": {"thread_id": "user-alice:session-1"}}

    graph.invoke(
        {"messages": [{"role": "user", "content": "My name is Alice."}]},
        cfg,
    )
    result = graph.invoke(
        {"messages": [{"role": "user", "content": "What is my name?"}]},
        cfg,
    )
    # Persists across restarts; shareable across processes; supports many concurrent users
    print(result["messages"][-1].content)  # "Your name is Alice."
```

### Key differences

| Dimension | `ConversationBufferMemory` | `PostgresSaver` + `thread_id` |
|---|---|---|
| Persistence | In-RAM, dies on restart | Postgres — durable |
| Multi-user | Single instance per chain | One `thread_id` per user/session |
| Concurrent access | Not thread-safe | Postgres handles concurrency |
| History length management | None (overflows silently) | You must add `trim_messages` or `SummarizationNode` |
| Cross-session facts | Not supported | Add `PostgresStore` separately |

---

## 2. `ConversationSummaryMemory` → `SummarizationNode`

`ConversationSummaryMemory` maintained a rolling summary of the conversation using an LLM
call. `SummarizationNode` is the direct successor — it runs as a graph node, writes the
running summary to `state["context"]`, and outputs the summarised view to
`state["summarized_messages"]`.

### Old (LangChain, pre-v0.3.1)

```python
from langchain.memory import ConversationSummaryMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
memory = ConversationSummaryMemory(llm=llm, return_messages=True)
chain = ConversationChain(llm=llm, memory=memory)

chain.predict(input="Tell me about the project we discussed.")
chain.predict(input="What were the key decisions?")
# Summary is regenerated on every call; no threshold; no persistence across restarts
```

### New (LangGraph + SummarizationNode)

```python
from __future__ import annotations

from typing_extensions import TypedDict
from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langchain_core.messages.utils import count_tokens_approximately
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph, START, MessagesState
from langmem.short_term import SummarizationNode, RunningSummary

DB_URI = "postgresql://user:pass@localhost:5432/mydb"

main_model = init_chat_model("openai:gpt-4o")
# Bind max_tokens to cap summary length at the model level
summarisation_model = main_model.bind(max_tokens=256)

class State(MessagesState):
    # RunningSummary must live in state so it accumulates across turns
    context: dict[str, RunningSummary]

class LLMInputState(TypedDict):
    summarized_messages: list[AnyMessage]
    context: dict[str, RunningSummary]

summarisation_node = SummarizationNode(
    token_counter=count_tokens_approximately,
    model=summarisation_model,
    max_tokens=4_096,               # cap on final output sent to model
    max_tokens_before_summary=3_500,  # trigger threshold
    max_summary_tokens=256,         # budget reservation (not LLM cap — use bind above)
    # output_messages_key="summarized_messages"  # default; separate from "messages"
)

def call_model(state: LLMInputState) -> dict:
    # Reads from summarized_messages, not messages
    response = main_model.invoke(state["summarized_messages"])
    return {"messages": [response]}

builder = StateGraph(State)
builder.add_node("summarize", summarisation_node)
builder.add_node("call_model", call_model)
builder.add_edge(START, "summarize")
builder.add_edge("summarize", "call_model")

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)

    cfg = {"configurable": {"thread_id": "user-alice:session-1"}}
    graph.invoke({"messages": [{"role": "user", "content": "Tell me about the project."}]}, cfg)
```

### Key differences

| Dimension | `ConversationSummaryMemory` | `SummarizationNode` |
|---|---|---|
| Trigger | Every call | Token threshold (`max_tokens_before_summary`) |
| Summary persistence | In-RAM | `state["context"]` → Postgres checkpoint |
| Output key | Replaces messages | Separate key (`summarized_messages`) by default |
| Tool-call pairing | Not applicable | Preserves AI+Tool message pairs |
| Async/deferred | Not supported | Deferrable via background task (see `short-term.md`) |

---

## 3. `ConversationBufferWindowMemory` → `trim_messages`

`ConversationBufferWindowMemory` kept the last `k` message pairs (or exchanges). The direct
replacement is `trim_messages` with `token_counter=len` to count messages rather than tokens.

### Old (LangChain, pre-v0.3.1)

```python
from langchain.memory import ConversationBufferWindowMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
# k=5 means keep the last 5 human+AI message pairs (10 messages total)
memory = ConversationBufferWindowMemory(k=5, return_messages=True)
chain = ConversationChain(llm=llm, memory=memory)

chain.predict(input="Turn 1")
chain.predict(input="Turn 6")  # Turn 1 is now dropped from context
```

### New (LangGraph + trim_messages)

```python
from __future__ import annotations

from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langchain_core.messages import trim_messages
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph, START, MessagesState
from typing_extensions import TypedDict

DB_URI = "postgresql://user:pass@localhost:5432/mydb"
llm = init_chat_model("openai:gpt-4o")

class State(MessagesState):
    llm_input_messages: list[AnyMessage]

def trim_to_window(state: State) -> dict:
    """
    Keep the most recent 10 messages (equivalent to k=5 pairs).
    Uses token_counter=len so max_tokens is a message count, not token count.
    """
    if not state["messages"]:
        return {"llm_input_messages": []}
    trimmed = trim_messages(
        state["messages"],
        max_tokens=10,          # 10 messages = 5 human+AI pairs
        strategy="last",
        token_counter=len,      # count messages, not tokens
        include_system=True,
        start_on="human",
        allow_partial=False,
    )
    return {"llm_input_messages": trimmed}

def call_model(state: State) -> dict:
    response = llm.invoke(state["llm_input_messages"])
    return {"messages": [response]}

builder = StateGraph(State)
builder.add_node("trim", trim_to_window)
builder.add_node("call_model", call_model)
builder.add_edge(START, "trim")
builder.add_edge("trim", "call_model")

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)

    cfg = {"configurable": {"thread_id": "user-alice:session-1"}}
    for i in range(8):
        graph.invoke(
            {"messages": [{"role": "user", "content": f"Turn {i + 1}"}]},
            cfg,
        )
    # After 8 turns the model only sees turns 3-8 (last 10 messages after trim)
```

### Token-budget variant (more accurate than message-count)

```python
from langchain_core.messages.utils import count_tokens_approximately

def trim_to_token_budget(state: State) -> dict:
    """Trim to 4 000-token budget using approximate token counter."""
    if not state["messages"]:
        return {"llm_input_messages": []}
    trimmed = trim_messages(
        state["messages"],
        max_tokens=4_000,
        strategy="last",
        token_counter=count_tokens_approximately,
        include_system=True,
        start_on="human",
        allow_partial=False,
    )
    return {"llm_input_messages": trimmed}
```

### Key differences

| Dimension | `ConversationBufferWindowMemory` | `trim_messages` |
|---|---|---|
| Unit | Message pairs (k) | Tokens or message count (configurable) |
| Persistence | In-RAM | Full history in Postgres; trimmed view is ephemeral per-turn |
| System message handling | Not applicable | `include_system=True` preserves it |
| Cost | None | None (no LLM call) |

---

## 4. `VectorStoreRetrieverMemory` → LangMem Search Tool / `store.search()`

`VectorStoreRetrieverMemory` stored summaries in a vector store and retrieved relevant ones
via similarity search. The LangGraph replacement is either a LangMem search tool (agent-driven)
or a deterministic `store.search()` injection node (always-on).

### Old (LangChain, pre-v0.3.1)

```python
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI

embeddings = OpenAIEmbeddings()
vectorstore = FAISS.from_texts([""], embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

memory = VectorStoreRetrieverMemory(retriever=retriever)
chain = ConversationChain(llm=ChatOpenAI(), memory=memory)

chain.predict(input="I prefer Python.")
chain.predict(input="What language do I prefer?")
# In-process FAISS; not shareable; not persistent across restarts
```

### New — Option A: Agent-driven search tool (LangMem)

The agent decides when to search. Lower baseline token cost; risk of missed recalls.

```python
from __future__ import annotations

from langchain.chat_models import init_chat_model
from langgraph.prebuilt import create_react_agent
from langgraph.store.postgres import PostgresStore
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
from langmem import create_manage_memory_tool, create_search_memory_tool

DB_URI = "postgresql://user:pass@localhost:5432/mydb"
pool = ConnectionPool(
    conninfo=DB_URI,
    kwargs={"autocommit": True, "row_factory": dict_row},
    min_size=2,
    max_size=10,
)
store = PostgresStore(
    conn=pool,
    index={"dims": 1536, "embed": "openai:text-embedding-3-small", "fields": ["text"]},
)
store.setup()

agent = create_react_agent(
    init_chat_model("openai:gpt-4o"),
    tools=[
        create_manage_memory_tool(namespace=("memories", "{user_id}")),
        create_search_memory_tool(namespace=("memories", "{user_id}")),
    ],
    store=store,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "I prefer Python."}]},
    config={"configurable": {"user_id": "user-alice"}},
)
result2 = agent.invoke(
    {"messages": [{"role": "user", "content": "What language do I prefer?"}]},
    config={"configurable": {"user_id": "user-alice"}},
)
```

### New — Option B: Deterministic injection node (always-on recall)

Searches at session start for every turn. Higher fixed token cost; deterministic recall.

```python
from __future__ import annotations

from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.store.base import BaseStore
from langgraph.store.postgres import PostgresStore
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

DB_URI = "postgresql://user:pass@localhost:5432/mydb"
pool = ConnectionPool(
    conninfo=DB_URI,
    kwargs={"autocommit": True, "row_factory": dict_row},
    min_size=2,
    max_size=10,
)
store = PostgresStore(
    conn=pool,
    index={"dims": 1536, "embed": "openai:text-embedding-3-small", "fields": ["text"]},
)
store.setup()

llm = init_chat_model("openai:gpt-4o")

class State(MessagesState):
    user_id: str
    memory_context: str

def load_memories(state: State, *, store: BaseStore) -> dict:
    """Retrieve semantically relevant memories on every turn."""
    if not state["messages"]:
        return {"memory_context": ""}
    query = state["messages"][-1].content
    results = store.search(
        ("memories", state["user_id"]),
        query=query,
        limit=5,
    )
    block = "\n".join(
        f"- {r.value.get('content', str(r.value))}" for r in results
    )
    return {"memory_context": block}

def write_memory(state: State, *, store: BaseStore) -> dict:
    """Persist the last exchange as a memory item."""
    messages = state["messages"]
    if len(messages) >= 2:
        last_human = next(
            (m.content for m in reversed(messages) if m.type == "human"), ""
        )
        last_ai = next(
            (m.content for m in reversed(messages) if m.type == "ai"), ""
        )
        if last_human and last_ai:
            import uuid
            store.put(
                ("memories", state["user_id"]),
                str(uuid.uuid4()),
                {"content": f"User said: {last_human}\nAssistant replied: {last_ai}"},
            )
    return {}

def call_model(state: State) -> dict:
    system = {
        "role": "system",
        "content": (
            f"You are a helpful assistant.\n\nRelevant memories:\n{state['memory_context']}"
            if state["memory_context"]
            else "You are a helpful assistant."
        ),
    }
    response = llm.invoke([system, *state["messages"]])
    return {"messages": [response]}

builder = StateGraph(State)
builder.add_node("load_memories", load_memories)
builder.add_node("call_model", call_model)
builder.add_node("write_memory", write_memory)
builder.add_edge(START, "load_memories")
builder.add_edge("load_memories", "call_model")
builder.add_edge("call_model", "write_memory")

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer, store=store)

    cfg = {"configurable": {"thread_id": "user-alice:session-1"}}
    graph.invoke(
        {"messages": [{"role": "user", "content": "I prefer Python."}],
         "user_id": "user-alice"},
        cfg,
    )
    result = graph.invoke(
        {"messages": [{"role": "user", "content": "What language do I prefer?"}],
         "user_id": "user-alice"},
        cfg,
    )
    print(result["messages"][-1].content)  # should reference Python
```

### Key differences

| Dimension | `VectorStoreRetrieverMemory` | LangMem tool / `store.search()` |
|---|---|---|
| Persistence | In-process FAISS (or other local store) | Postgres + pgvector — durable, multi-process |
| Recall trigger | Every chain invocation | Agent-discretion (tool) or always-on (injection node) |
| Multi-user | Not supported | Namespace-scoped by `user_id` |
| Cross-session | Only if FAISS serialised manually | Native — Store is persistent by default |
| Writes | Manual `memory.save_context()` call | `manage_memory` tool or `store.put()` node |

---

## 5. Entity Memory / `ZepMemory` → LangMem Semantic Memory

### Legacy `ZepMemory` (broken — do not use)

The legacy `ZepMemory` import from `langchain-community` is broken (see issue #27356) and
superseded by `ZepCloudMemory`. If you are migrating from `ZepMemory`, use `ZepCloudMemory`
from `langchain_community.memory.zep_cloud_memory` and follow the Zep Cloud migration guide.

### Old (LangChain entity memory, pre-v0.3.1)

```python
from langchain.memory import ConversationEntityMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
memory = ConversationEntityMemory(llm=llm, return_messages=True)
chain = ConversationChain(llm=llm, memory=memory)

chain.predict(input="Alice is a senior engineer who likes Python and dark mode.")
chain.predict(input="What do you know about Alice?")
```

### New (LangMem typed semantic memory)

```python
from __future__ import annotations

from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model
from langgraph.store.memory import InMemoryStore
from langmem import create_memory_store_manager, create_search_memory_tool
from langmem import ReflectionExecutor

class PersonEntity(BaseModel):
    """A person entity extracted from conversation."""
    name: str = Field(description="The person's name")
    role: str = Field(default="", description="Their role or job title")
    skills: list[str] = Field(default_factory=list, description="Technical or professional skills")
    preferences: list[str] = Field(default_factory=list, description="Stated preferences")
    notes: list[str] = Field(default_factory=list, description="Other notable facts")

store = InMemoryStore()

entity_manager = create_memory_store_manager(
    "openai:gpt-4o",
    schemas=[PersonEntity],
    namespace=("entities", "{user_id}"),
    enable_inserts=True,   # each entity is a separate searchable record
    enable_deletes=True,
    store=store,
)

# Extract entities from a conversation
entity_manager.invoke({
    "messages": [
        {"role": "user", "content": "Alice is a senior engineer who likes Python and dark mode."}
    ]
})

# Retrieve via semantic search
search_tool = create_search_memory_tool(
    namespace=("entities", "{user_id}"),
    store=store,
)
result = search_tool.invoke({"query": "Alice's skills", "limit": 3})
print(result)
```

> **Note — temporal reasoning limitation:** LangMem's LOCOMO temporal score is 23.43% (barely
> above the 21.71% baseline). For use cases where temporal knowledge-graph queries are critical
> (e.g., "what did Alice's role change to last quarter?"), consider `ZepCloudMemory` or a
> dedicated knowledge graph rather than LangMem's semantic memory.

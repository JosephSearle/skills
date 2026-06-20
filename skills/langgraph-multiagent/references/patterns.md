# Multi-Agent Patterns Reference

## Pattern Overview

LangChain's official multi-agent guide defines five patterns. The table below shows their
performance characteristics on three benchmark scenarios from the official guide.

### Token / call benchmarks (official LangChain guide)

| Pattern | One-shot calls | Repeat (2nd req) calls | Repeat total | Multi-domain calls | Multi-domain tokens |
|---|---|---|---|---|---|
| Subagents | 4 | 4 | **8** | 5 | ~9K |
| Handoffs | 3 | 2 | **5** | 7+ | ~14K+ |
| Skills | 3 | 2 | **5** | 3 | ~15K |
| Router | 3 | 3 | **6** | 5 | ~9K |
| Custom | varies | varies | varies | varies | varies |

Key observations:
- Handoffs and Skills save 40–50% of calls on repeat requests (5 total vs 8 for Subagents).
- Multi-domain: Subagents/Router win on tokens (~9K); Skills accumulate context (~15K);
  Handoffs are sequential and cannot parallelize multi-domain work (7+ calls).
- Router is the most consistent across one-shot and repeat; use it when domain classification
  is cheap and deterministic.

### When to use each pattern

| Pattern | Choose when | Avoid when |
|---|---|---|
| Subagents | Parallel isolation needed; each worker is independent | Repeat requests — state not shared; calls double |
| Handoffs | State must flow between specialists; sequential is acceptable | Multi-domain parallel work; handoff loops are a risk |
| Skills | Many narrow prompt-loaded capabilities; minimize context | Tools already in context; progressive loading adds latency |
| Router | Clear domain classifier; you want consistent call counts | Routing ambiguity — misclassification is unrecoverable |
| Custom | Deterministic branching; no LLM routing needed | Any use case needing emergent agent decisions |

---

## Pattern 1 — Manual Supervisor via `Command(goto=)`

> **Recommended default.** `langgraph-supervisor` README explicitly recommends this manual
> approach over using the library for most use cases. See "langgraph-supervisor warning" below.

The modern manual supervisor returns `Command(goto=...)` directly from node functions.
No `add_conditional_edges` is needed — routing logic lives in Python code, not graph topology.

```python
from __future__ import annotations

from typing import Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.types import Command
from pydantic import BaseModel

SUPERVISOR_PROMPT = """\
You are a routing supervisor. Given the conversation, decide which specialist to call next,
or FINISH if the task is complete.
Respond with JSON: {"next": "<researcher|analyst|FINISH>"}
"""

RESEARCHER_PROMPT = "You are a research specialist. Find relevant information and summarize it."
ANALYST_PROMPT = "You are a data analyst. Interpret findings and produce structured conclusions."

llm = ChatAnthropic(model="claude-sonnet-4-6")


class Router(BaseModel):
    next: Literal["researcher", "analyst", "FINISH"]


# ── Supervisor node ──────────────────────────────────────────────────────────

def supervisor(state: MessagesState) -> Command[Literal["researcher", "analyst", "__end__"]]:
    response = llm.with_structured_output(Router).invoke(
        [SystemMessage(content=SUPERVISOR_PROMPT)] + state["messages"]
    )
    if response.next == "FINISH":
        return Command(goto=END)
    return Command(goto=response.next)


# ── Worker nodes ─────────────────────────────────────────────────────────────

def researcher(state: MessagesState) -> Command[Literal["supervisor"]]:
    result = llm.invoke(
        [SystemMessage(content=RESEARCHER_PROMPT)] + state["messages"]
    )
    return Command(
        update={"messages": [AIMessage(content=result.content, name="researcher")]},
        goto="supervisor",
    )


def analyst(state: MessagesState) -> Command[Literal["supervisor"]]:
    result = llm.invoke(
        [SystemMessage(content=ANALYST_PROMPT)] + state["messages"]
    )
    return Command(
        update={"messages": [AIMessage(content=result.content, name="analyst")]},
        goto="supervisor",
    )


# ── Graph assembly ────────────────────────────────────────────────────────────

builder = StateGraph(MessagesState)
builder.add_node("supervisor", supervisor)
builder.add_node("researcher", researcher)
builder.add_node("analyst", analyst)
builder.add_edge(START, "supervisor")

agent = builder.compile(recursion_limit=50)
```

---

## Pattern 2 — Handoff Tools (`InjectedToolCallId` + `InjectedState`)

Handoff tools are the tool-calling flavor of the supervisor pattern. The tool returns a
`Command` combining state update and control-flow transfer. The `graph=Command.PARENT`
field navigates from the sub-agent's graph back up to the parent graph.

```python
from __future__ import annotations

from typing import Annotated

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import InjectedState, create_react_agent
from langgraph.types import Command

llm = ChatAnthropic(model="claude-sonnet-4-6")


def make_handoff_tool(*, agent_name: str, description: str | None = None):
    """Build a transfer tool that hands control to agent_name."""
    tool_name = f"transfer_to_{agent_name}"

    @tool(tool_name, description=description or f"Transfer to {agent_name}.")
    def handoff_tool(
        state: Annotated[MessagesState, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
    ) -> Command:
        tool_message = {
            "role": "tool",
            "content": f"Transferred to {agent_name}.",
            "name": tool_name,
            "tool_call_id": tool_call_id,
        }
        return Command(
            goto=agent_name,
            graph=Command.PARENT,
            update={**state, "messages": state["messages"] + [tool_message]},
        )

    return handoff_tool


# ── Agents ────────────────────────────────────────────────────────────────────

billing_agent = create_react_agent(
    llm,
    tools=[make_handoff_tool(agent_name="support_agent", description="Escalate to support.")],
    name="billing_agent",
    state_schema=MessagesState,
)

support_agent = create_react_agent(
    llm,
    tools=[make_handoff_tool(agent_name="billing_agent", description="Transfer to billing.")],
    name="support_agent",
    state_schema=MessagesState,
)


# ── Supervisor with tool-calling ──────────────────────────────────────────────

def supervisor(state: MessagesState) -> Command:
    transfer_to_billing = make_handoff_tool(agent_name="billing_agent")
    transfer_to_support = make_handoff_tool(agent_name="support_agent")
    result = llm.bind_tools([transfer_to_billing, transfer_to_support]).invoke(state["messages"])
    if not result.tool_calls:
        return Command(goto=END, update={"messages": [result]})
    # Tool call will be executed by the ToolNode; Command routes to appropriate agent.
    return Command(update={"messages": [result]}, goto="tools")


builder = StateGraph(MessagesState)
builder.add_node("supervisor", supervisor)
builder.add_node("billing_agent", billing_agent)
builder.add_node("support_agent", support_agent)
builder.add_edge(START, "supervisor")

graph = builder.compile(recursion_limit=40)
```

---

## Pattern 3 — `langgraph-supervisor` Library

> **WARNING — library de-emphasised by its own maintainers.**
> The `langgraph-supervisor` README (v0.0.31, Nov 2025) now explicitly recommends the
> **manual supervisor-via-tools pattern** over using this library for most use cases,
> citing better context-engineering control. Reserve this library for quick prototypes;
> plan to migrate to the manual pattern before production.

### `create_supervisor` full signature (v0.0.31)

```python
from langgraph_supervisor import create_supervisor
from langgraph.prebuilt import create_react_agent
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver

llm = ChatAnthropic(model="claude-sonnet-4-6")

# Workers MUST have a unique name — not None and not "LangGraph"
researcher = create_react_agent(llm, tools=[], name="researcher")
analyst    = create_react_agent(llm, tools=[], name="analyst")

# create_supervisor returns an UNCOMPILED StateGraph — call .compile() yourself
graph = create_supervisor(
    agents=[researcher, analyst],
    model=llm,
    tools=None,               # shared tools available alongside handoff tools
    prompt=None,              # optional system prompt for supervisor
    response_format=None,     # structured output for final response
    pre_model_hook=None,
    post_model_hook=None,
    parallel_tool_calls=False,  # set True (OpenAI/Anthropic) for simultaneous dispatch
    state_schema=None,          # defaults to MessagesState
    context_schema=None,        # formerly config_schema (deprecated alias still accepted)
    output_mode="last_message", # "last_message" | "full_history"
    add_handoff_messages=True,
    handoff_tool_prefix=None,
    add_handoff_back_messages=None,  # None → inherits add_handoff_messages
    supervisor_name="supervisor",
    include_agent_name=None,
).compile(checkpointer=InMemorySaver())
```

### `output_mode` tradeoff

| Mode | Messages added to parent | Tokens | Use case |
|---|---|---|---|
| `"last_message"` (default) | Last 1–2 messages from worker | Low | Cost-sensitive; supervisor sees summary |
| `"full_history"` | All worker messages | High | Audit trail; parent must see every step |

Same run: `last_message` produced 12 messages; `full_history` produced 23 — a direct
context-window/cost tradeoff verified in the library's own test suite.

### `create_handoff_tool` signature (v0.0.31)

```python
from langgraph_supervisor import create_handoff_tool

# All parameters are keyword-only
tool = create_handoff_tool(
    agent_name="researcher",         # required
    name=None,                       # default: "transfer_to_researcher"
    description=None,                # default: "Ask agent researcher for help"
    add_handoff_messages=True,       # prepend ToolMessage on transfer
)
```

### Worker name validation (raises `ValueError`)

```python
# These two checks run at create_supervisor() time — not at compile() time:
if agent.name is None or agent.name == "LangGraph":
    raise ValueError(
        "Please specify a name when you create your agent, either via "
        "`create_react_agent(..., name=agent_name)` or via `graph.compile(name=name)`."
    )
if agent.name in agent_names:
    raise ValueError(
        f"Agent with name '{agent.name}' already exists. Agent names must be unique."
    )
```

---

## Pattern 4 — Swarm (`langgraph-swarm`)

> **Version:** `langgraph-swarm` **v0.1.0** (Dec 4 2025). Headline change: migration to
> LangChain 1.0 (`fix: migrate to langchain 1.0`, PR #110). Pin `0.1.x` when using.

Swarm models **peer-to-peer** handoffs. An `active_agent` state key persists which agent
was last active across turns. A checkpointer is required for multi-turn conversations —
without one, the swarm forgets the active agent and full conversation history.

```python
from __future__ import annotations

from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.prebuilt import create_react_agent
from langgraph_swarm import create_handoff_tool, create_swarm

llm = ChatAnthropic(model="claude-sonnet-4-6")

alice = create_react_agent(
    llm,
    tools=[
        create_handoff_tool(
            agent_name="Bob",
            description="Transfer to Bob for billing questions.",
        )
    ],
    name="Alice",
)

bob = create_react_agent(
    llm,
    tools=[
        create_handoff_tool(
            agent_name="Alice",
            description="Transfer back to Alice for general questions.",
        )
    ],
    name="Bob",
)

app = create_swarm(
    [alice, bob],
    default_active_agent="Alice",  # required
).compile(checkpointer=InMemorySaver())

# Multi-turn invocation — thread_id maintains active_agent across turns
config = {"configurable": {"thread_id": "session-1"}}
result = app.invoke({"messages": [{"role": "user", "content": "I need help with my bill."}]}, config)
```

### Swarm vs Supervisor decision table

| Dimension | Supervisor | Swarm |
|---|---|---|
| Control flow | Central coordinator routes all traffic | Peers hand off directly |
| Active agent tracking | No built-in; supervisor re-routes each turn | `active_agent` key persists last specialist |
| Checkpointer required | Optional (needed for HITL) | **Required** for multi-turn |
| Parallel dispatch | Yes (via `parallel_tool_calls`) | Limited |
| Best fit | Clear hierarchy; one agent owns routing | Tight peer collaboration; resume-with-specialist |
| Main failure mode | Supervisor bottleneck; recursion loops | Handoff ping-pong (A↔B loop) |

### Handoff loop mitigation

```python
from __future__ import annotations

from langgraph.graph import MessagesState


def detect_handoff_loop(state: MessagesState, *, limit: int = 3) -> bool:
    """Return True if the last `limit` tool calls are all handoff transfers."""
    tool_names = [
        m.name
        for m in state["messages"]
        if hasattr(m, "name") and m.name and m.name.startswith("transfer_to_")
    ]
    if len(tool_names) < limit:
        return False
    return len(set(tool_names[-limit:])) == 1
```

---

## Pattern 5 — Network / Mesh (Raw StateGraph)

Any-to-any routing: each agent node computes its own `Command(goto=next)`. A shared
`MessagesState` acts as the message bus / blackboard. Use `Send` for map-reduce fan-out.

```python
from __future__ import annotations

from typing import Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.types import Command, Send
from pydantic import BaseModel

llm = ChatAnthropic(model="claude-sonnet-4-6")


class Route(BaseModel):
    next: Literal["planner", "executor", "reviewer", "DONE"]


def planner(state: MessagesState) -> Command[Literal["executor"]]:
    result = llm.invoke([SystemMessage("Plan the work.")] + state["messages"])
    return Command(
        update={"messages": [AIMessage(content=result.content, name="planner")]},
        goto="executor",
    )


def executor(state: MessagesState) -> Command[Literal["reviewer"]]:
    result = llm.invoke([SystemMessage("Execute the plan.")] + state["messages"])
    return Command(
        update={"messages": [AIMessage(content=result.content, name="executor")]},
        goto="reviewer",
    )


def reviewer(state: MessagesState) -> Command[Literal["planner", "__end__"]]:
    route = llm.with_structured_output(Route).invoke(
        [SystemMessage("Review: route back to planner or DONE.")] + state["messages"]
    )
    if route.next == "DONE":
        return Command(goto=END)
    return Command(goto="planner")


builder = StateGraph(MessagesState)
builder.add_node("planner", planner)
builder.add_node("executor", executor)
builder.add_node("reviewer", reviewer)
builder.add_edge(START, "planner")

graph = builder.compile(recursion_limit=30)
```

### Map-reduce fan-out with `Send`

```python
from langgraph.types import Send


def dispatch_workers(state: MessagesState) -> list[Send]:
    """Fan out to N parallel workers."""
    topics = ["topic_a", "topic_b", "topic_c"]
    return [Send("worker", {"messages": state["messages"], "topic": t}) for t in topics]


builder.add_conditional_edges("coordinator", dispatch_workers, ["worker"])
```

---

## Pattern 6 — Subgraph Isolation

Compile each agent as its own `StateGraph` and add it as a node. Isolated `checkpoint_ns`
prevents state leakage across workers.

```python
from __future__ import annotations

from typing import TypedDict

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing import Annotated

llm = ChatAnthropic(model="claude-sonnet-4-6")


# ── Worker-scoped state ───────────────────────────────────────────────────────

class WorkerState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    topic: str


# ── Worker subgraph ───────────────────────────────────────────────────────────

def worker_node(state: WorkerState) -> dict:
    result = llm.invoke(
        [SystemMessage(f"Research: {state['topic']}")] + state["messages"]
    )
    return {"messages": [AIMessage(content=result.content, name="worker")]}


worker_builder = StateGraph(WorkerState)
worker_builder.add_node("research", worker_node)
worker_builder.add_edge(START, "research")
worker_builder.add_edge("research", END)
worker_graph = worker_builder.compile(name="worker")  # unique name = stable checkpoint_ns


# ── Parent state ──────────────────────────────────────────────────────────────

class ParentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    topic: str


def parent_node(state: ParentState) -> dict:
    result = worker_graph.invoke({"messages": state["messages"], "topic": state["topic"]})
    return {"messages": result["messages"]}


parent_builder = StateGraph(ParentState)
parent_builder.add_node("worker", parent_node)
parent_builder.add_edge(START, "worker")
parent_builder.add_edge("worker", END)
parent_graph = parent_builder.compile()
```

### Subgraph checkpointing gotchas

| Gotcha | Detail |
|---|---|
| `checkpointer=True` vs plain `.compile()` | `checkpointer=True` persists subgraph memory in isolation; plain `.compile()` = `checkpointer=False` — subgraph state is not retained across steps |
| Parallel tool calls + shared namespace | Per-thread subgraphs do NOT support parallel tool calls — same subgraph called twice in parallel causes checkpoint namespace conflicts |
| State inspection | Use `get_state(config, subgraphs=True)` — only works when subgraph is added as a node, NOT when called inside a tool |
| Unique node name | Wrap each subagent in a unique node name for a stable `checkpoint_ns` |

---

## Production Gotchas

| Failure mode | Root cause | Fix |
|---|---|---|
| `GraphRecursionError` | Default `recursion_limit=25` hit | Set limit explicitly at `.compile(recursion_limit=N)` |
| Supervisor bottleneck | Every turn goes through one LLM | Use `parallel_tool_calls=True` or swarm for peer routing |
| `ParentCommand` error at depth ≥3 | `Command(graph=Command.PARENT)` from a deeply nested graph | Flatten hierarchy or handle at depth ≤2 |
| Checkpoint storage explosion | Snapshot-every-step grows O(N²) | Enable DeltaChannel (langgraph ≥1.2, beta) — 41× reduction reported for 200-turn sessions |
| Worker tool call lost | Sub-agent failure not surfaced | Handle `ToolMessage` errors in reducer; add node-level retry |
| Stream output not attributed | Default `stream_version="v1"` | Pass `subgraphs=True`; chunks become `(namespace, data)` tuples |
| Context window overflow | `output_mode="full_history"` on long sessions | Switch to `output_mode="last_message"` or enable summarization |

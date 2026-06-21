# Agent Protocol Transport Reference — deepagents AsyncSubAgent

---

## Two transport modes

| Mode | When | Mechanism | Latency |
|---|---|---|---|
| **In-process (ASGI)** | `url` omitted from `AsyncSubAgent` | In-process function calls via LangGraph ASGI | Zero network latency |
| **Remote (HTTP)** | `url` set to Agent Protocol server | HTTP calls to the server at `url` | Network + auth overhead |

---

## In-process ASGI transport

When `url` is omitted, the SDK routes calls through **in-process function calls** rather than HTTP. This requires both the supervisor graph and the subagent graph to be **registered in the same `langgraph.json`**:

```json
{
  "graphs": {
    "supervisor": "./supervisor.py:agent",
    "researcher": "./researcher.py:subagent",
    "coder": "./coder.py:subagent"
  }
}
```

```python
# researcher graph is in the same langgraph.json → url omitted
async_researcher: AsyncSubAgent = {
    "name": "researcher",
    "description": "Researches topics.",
    "graph_id": "researcher",   # must match key in langgraph.json
    # url not set → in-process
}
```

**Benefits of in-process:**
- Zero network latency
- No extra auth/TLS configuration
- Shared deployment — both graphs in one server

**Constraints:**
- Both graphs must be deployed together (no independent scaling per subagent)
- Subagent graph must be registered in `langgraph.json` before the server starts

---

## Remote HTTP transport (Agent Protocol server)

Any **Agent Protocol-compliant server** is a valid target:

```python
async_remote: AsyncSubAgent = {
    "name": "remote-coder",
    "description": "A remote coding agent.",
    "graph_id": "coder-graph",
    "url": "https://my-coder-service.langsmith.com",
}
```

Valid Agent Protocol targets:
- LangSmith deployments (managed LangGraph Server)
- Self-hosted LangGraph Server (see `langgraph-deployment` skill)
- Custom FastAPI servers implementing the Agent Protocol spec
- Any server responding to the Agent Protocol HTTP interface

---

## Why Agent Protocol (not ACP or A2A)?

LangChain chose Agent Protocol over the alternatives at the time of async subagent launch:

| Protocol | Status at launch | Reason not chosen |
|---|---|---|
| **Agent Protocol** | Adopted | Clean HTTP + ASGI interface; supports both sync and async |
| ACP | Available | Stdio-only at the time — no HTTP transport |
| A2A | Available | LangChain kept lighter for faster iteration; Agent Protocol was sufficient |

---

## Auth when using remote URLs

When `url` is set, the SDK sends HTTP requests to that server. Auth configuration depends on the target:

- **LangSmith deployments:** Set `LANGSMITH_API_KEY` environment variable; the SDK includes it automatically.
- **Self-hosted LangGraph Server:** Configure auth middleware on the server; pass headers via SDK config if needed.
- **Custom servers:** Implement Agent Protocol auth headers on the server; pass via `headers=` param if the SDK supports it (check current deepagents docs for the `url`+`headers` combination).

---

## Diagram: in-process vs remote

```
In-process (url omitted):
  ┌─────────────────────────────────┐
  │ LangGraph Server Process        │
  │  ┌──────────────┐               │
  │  │  supervisor  │──ASGI──────►  │
  │  └──────────────┘   │           │
  │                      ▼          │
  │              ┌──────────────┐   │
  │              │  researcher  │   │
  │              └──────────────┘   │
  └─────────────────────────────────┘

Remote (url set):
  ┌──────────────┐       HTTP       ┌──────────────────────┐
  │  supervisor  │◄────────────────►│ Agent Protocol Server │
  │  (process A) │                  │  (process B / cloud)  │
  └──────────────┘                  └──────────────────────┘
```

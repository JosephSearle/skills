---
name: langchain-agents
description: >
  Build, configure, and migrate LangChain v1 agents using the canonical create_agent factory.
  Triggers on: create_agent, AgentMiddleware, before_model, wrap_model_call, wrap_tool_call,
  PIIMiddleware, SummarizationMiddleware, HumanInTheLoopMiddleware, TodoListMiddleware,
  ModelCallLimitMiddleware, ToolRetryMiddleware, AgentState, response_format,
  ProviderStrategy, ToolStrategy, structured_response, system_prompt,
  AnthropicPromptCachingMiddleware, migrate AgentExecutor, create_react_agent deprecated,
  "langchain v1 agent", "AgentExecutor replacement", "ReAct agent LangChain",
  "LangChain middleware", "agent structured output", "thread persistence agent".
---

## Core Philosophy

`create_agent` is the single canonical entry point for any standard tool-calling agent in LangChain
v1.0+. It returns a compiled LangGraph `CompiledStateGraph` — not a wrapper — so checkpointing,
streaming, subgraph composition, and LangSmith tracing all work without extra scaffolding. Reach
for a hand-built `StateGraph` only when the loop abstraction actively fights you: parallel fan-out,
supervisor/worker topologies, or deterministic multi-step pipelines. Middleware is the right
extension point for every cross-cutting concern (PII, summarisation, HITL, retries, limits);
resist the urge to bake these concerns into tools or custom graph edges. Custom state schemas
MUST be `TypedDict` subclasses of `AgentState` — Pydantic models and dataclasses are not
supported in v1.

---

## Step 1 — Determine Context

| Intent | Signals | Action |
|---|---|---|
| **GREENFIELD** | New agent, no existing code, "build an agent", "create_agent from scratch" | Load `create-agent.md`; scaffold with minimal working example; apply middleware defaults |
| **RETROFIT** | "migrate AgentExecutor", "migrate create_react_agent deprecated", existing `AgentExecutor` or pre-v1 `create_react_agent` codebase | Load `migration-from-agentexecutor.md` first; then `create-agent.md` for target API |
| **SPECIFIC** | Question about a single feature: response_format / ProviderStrategy / ToolStrategy / structured_response, checkpointing, streaming | Load only `create-agent.md` §§ that cover that feature |
| **MIDDLEWARE** | Adding before_model / wrap_model_call / wrap_tool_call / PIIMiddleware / SummarizationMiddleware / HumanInTheLoopMiddleware / TodoListMiddleware / ModelCallLimitMiddleware / ToolRetryMiddleware / AnthropicPromptCachingMiddleware / custom AgentMiddleware | Load `middleware.md`; load `create-agent.md` if wiring into an agent for the first time |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/create-agent.md` | Full `create_agent` signature, model param variants, tools param, AgentState TypedDict, graph structure, thread persistence, response_format strategies | GREENFIELD, SPECIFIC, RETROFIT (as target); any question about create_agent params |
| `references/middleware.md` | All 6 hook methods, composition order, state schema extension, tool injection, all 15+ built-in middleware with signatures and gotchas | MIDDLEWARE; any question about built-in or custom AgentMiddleware |
| `references/migration-from-agentexecutor.md` | Side-by-side param mapping, code for both old and new sides, v0 restriction removals | RETROFIT; any question about migrating from AgentExecutor or pre-v1 create_react_agent |

---

## Step 3 — Build Agent

Apply these decision gates in order when constructing or reviewing a `create_agent` call.

### 3.1 Model param

| Input | Use | Constraint |
|---|---|---|
| String shorthand | `"openai:gpt-4o"`, `"claude-sonnet-4-5-20250929"` — parsed via `init_chat_model` | Simplest; provider inferred from prefix or model-ID registry |
| `BaseChatModel` instance | `ChatAnthropic(...)`, `ChatOpenAI(...)` — full config control | **Do NOT call `.bind_tools(...)` before passing** when `response_format` is also set |
| Configurable | `init_chat_model(..., configurable_fields=["model"])` | Allows per-invocation model overrides via `config` |

### 3.2 Tools param

Only `@tool`-decorated functions, plain callables (with type hints + docstring), `BaseTool`
instances, and provider `dict` tools are accepted. `ToolNode` instances are **not** accepted (v0
artifact). An empty list produces a model-only agent with no tool loop.

### 3.3 response_format strategy

| Scenario | Strategy | Notes |
|---|---|---|
| Provider supports native `json_schema` | `ProviderStrategy(Schema)` or bare `response_format=Schema` (auto-selected) | More reliable; check streaming suppression caveat |
| Any tool-calling model, no native json_schema | `ToolStrategy(Schema)` | Artificial tool; sets `tool_choice="any"` |
| Bare schema, unknown provider capability | `response_format=Schema` | Auto-selects ProviderStrategy → ToolStrategy fallback |
| No structured output needed | `response_format=None` (default) | Omit entirely |

Result always appears in `result["structured_response"]`.

### 3.4 Middleware ordering

Place middleware in the list from outermost (first) to innermost (last):
1. **Guardrails / limits first** — `ModelCallLimitMiddleware`, `PIIMiddleware` (input).
2. **Context manipulation** — `SummarizationMiddleware`, `AnthropicPromptCachingMiddleware`, `ContextEditingMiddleware`.
3. **Augmentation** — `TodoListMiddleware`, `LLMToolSelectorMiddleware`.
4. **Reliability** — `ModelRetryMiddleware`, `ToolRetryMiddleware`, `ModelFallbackMiddleware`.
5. **Observability / HITL last** — `HumanInTheLoopMiddleware`.

`before_model` / `after_model` node hooks run first→last / last→first respectively.
`wrap_*` wrappers nest like an onion: list[0] is outermost, wraps list[1], … wraps the actual call.

---

## Step 4 — Output & Verification

After generating agent code, provide:

1. **The `create_agent` call** with all chosen params explicitly set (no implicit defaults for
   non-trivial choices like `response_format`, `middleware`, `checkpointer`).
2. **An invocation example** showing `invoke` / `ainvoke` with `config={"configurable": {"thread_id": ...}}` if a checkpointer is used.
3. **Verification commands:**

```bash
# Install dependencies
uv add langchain langchain-anthropic langgraph

# Type-check the agent file
uv run mypy src/your_agent.py --strict

# Run the agent (replace with your module/script)
uv run python -m your_package.agent
```

If `HumanInTheLoopMiddleware` is present, note that a `checkpointer` is required and show the
`Command(resume=...)` pattern for approval.

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/create-agent.md](references/create-agent.md) | `create_agent` factory: full signature, model/tools params, AgentState, graph structure, persistence, response_format | Research §§ Key Findings, Structured output, Graph structure, Thread persistence |
| [references/middleware.md](references/middleware.md) | AgentMiddleware hooks, composition order, state extension, all 15+ built-ins with signatures and gotchas | Research §§ Middleware system, Built-in middleware, Custom middleware |
| [references/migration-from-agentexecutor.md](references/migration-from-agentexecutor.md) | AgentExecutor / create_react_agent → create_agent full param mapping with dual-sided code | Research §§ Migration from AgentExecutor / create_react_agent |

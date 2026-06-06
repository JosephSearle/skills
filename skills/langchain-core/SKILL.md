---
name: langchain-core
description: >
  Apply LangChain Core 1.x production patterns to Python 3.11+ projects using LCEL, the Runnable
  protocol, and the standardized chat-model interface. Triggers on: init_chat_model, RunnablePassthrough,
  with_structured_output, LCEL, pipe syntax, astream_events, RunnableConfig, content_blocks,
  ToolCall, ChatPromptTemplate, MessagesPlaceholder, PydanticOutputParser, BaseCallbackHandler,
  CacheBackedEmbeddings, langchain-community import, langchain-classic, hub.pull migration,
  "how do I chain", "structured output strategy", "streaming events", "retriever composition",
  "LLMChain migration", "RetrievalQA migration", "AgentExecutor replacement", "callback handler",
  "embed with caching", "output parser", "text splitter", "document loader", "vector store retriever".
---

## Core Philosophy

LangChain Core 1.0 (GA October 2025) locks the **Runnable/LCEL protocol as stable API** with a
no-breaking-changes commitment until 2.0; every other LangChain package depends on it.
The headline v1 additions are standardised `.content_blocks` on every message, `ToolStrategy`/
`ProviderStrategy` for structured output, and `init_chat_model("provider:model")` as the canonical
model factory — these three patterns are the preferred entry points for all new code.
Legacy chains (`LLMChain`, `RetrievalQA`, `AgentExecutor`, `ConversationBufferMemory`, `hub.pull`)
have moved to `langchain-classic` as a transitional package — treat it as a bridge, not a target.
`langchain-community` is **not** `langchain-classic`; it remains a separately maintained package
for integrations that have not yet migrated to dedicated partner packages.

---

## Step 1 — Determine Context

Classify the request before loading any reference:

| Intent | Signals | Action |
|---|---|---|
| **GREENFIELD** | "new project", "build a chain", "set up RAG", "start from scratch" | Load all references; emit full patterns with uv add commands |
| **RETROFIT** | "migrate from LLMChain", "upgrade from community import", "replace AgentExecutor", "hub.pull broken" | Load `migration.md` first; then the topic reference for the replacement |
| **SPECIFIC** | Single question about one component (streaming, structured output, callbacks, splitters) | Load only the one or two references that address the question |
| **AUDIT** | "review my LangChain code", "find deprecated imports", "check community imports" | Load `migration.md` + relevant topic reference; flag every deprecated pattern |

Cross-cutting checks:
1. **Python version** — confirm 3.11+; if <3.11 note the `RunnableConfig` ContextVar propagation gotcha (see `runnables.md`).
2. **Structured output strategy** — if the request involves extracting typed data, load `chat-models.md` §with_structured_output decision table before writing any code.
3. **Streaming** — if the request involves streaming to a UI, load `runnables.md` §astream_events.

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/runnables.md` | Runnable protocol, RunnableConfig, LCEL composition, astream_events | Any chain building, streaming, pipe operator, RunnableParallel/Branch/Passthrough, config propagation |
| `references/chat-models.md` | init_chat_model, message types, content_blocks, bind_tools, with_structured_output, configurable_fields | Any model invocation, provider switching, structured output, tool calling, streaming messages |
| `references/prompts-output-parsers.md` | ChatPromptTemplate, MessagesPlaceholder, FewShot, hub.pull migration, all output parsers | Any prompt construction, few-shot, hub usage, PydanticOutputParser, StrOutputParser |
| `references/loaders-splitters-embeddings.md` | Document/Blob, lazy_load, text splitters, SemanticChunker, init_embeddings, CacheBackedEmbeddings | Any document ingestion, chunking, embedding, caching embeddings |
| `references/retrievers-callbacks.md` | BaseRetriever, VectorStoreRetriever, EnsembleRetriever, advanced retrievers, BaseCallbackHandler, async callbacks | Any retrieval, hybrid search, custom callbacks, token streaming to UI, LangSmith tracing |
| `references/migration.md` | Deprecated → current API table, LLMChain/RetrievalQA/AgentExecutor/memory rewrites, community import renames | Any migration, deprecated import warnings, chain/agent replacement, hub.pull fix |

For GREENFIELD RAG: load `chat-models.md` + `runnables.md` + `loaders-splitters-embeddings.md` + `retrievers-callbacks.md`.
For GREENFIELD agent: load `chat-models.md` + `runnables.md` + `prompts-output-parsers.md`.
For RETROFIT: always start with `migration.md`, then the topic reference.

---

## Step 3 — Apply Patterns

**Which composition primitive?**

| Task | Use |
|---|---|
| Deterministic linear pipeline | `a \| b \| c` (pipe / `RunnableSequence`) |
| Fan-out same input to multiple branches | `RunnableParallel` or dict literal in pipe |
| Pass-through input unchanged | `RunnablePassthrough` |
| Add keys to dict input | `RunnablePassthrough.assign(key=runnable)` |
| Conditional routing | `RunnableBranch((condition, runnable), ..., default)` |
| Wrap a plain function | `RunnableLambda(fn)` |
| Custom streaming transform | `RunnableGenerator` |
| Retry on failure | `.with_retry(retry_if_exception_type=..., stop_after_attempt=N)` |
| Provider failover | `.with_fallbacks([backup])` |

**Which structured output strategy?**

See `references/chat-models.md` §with_structured_output for the full decision table. Quick gate:
- Simple schema + capable provider → `ProviderStrategy` / `method="json_schema"`
- Complex/nullable schema → `ToolStrategy` / `method="function_calling"`
- Anthropic + extended thinking → `ToolStrategy` is unsafe; use `include_raw=True` + manual parse

**Which retriever?**

| Need | Retriever |
|---|---|
| Single vector store | `vectorstore.as_retriever(search_type="mmr", search_kwargs={...})` |
| Keyword + dense hybrid | `EnsembleRetriever([bm25, dense], weights=[0.4, 0.6])` from `langchain-classic` |
| Multi-query rewriting | `MultiQueryRetriever` from `langchain-classic` |
| Small chunks → return large parent | `ParentDocumentRetriever` from `langchain-classic` |
| Metadata filter from NL | `SelfQueryRetriever` from `langchain-classic` |

---

## Step 4 — Output & Verification

After writing code, provide:

```bash
# Install packages (no pip — use uv)
uv add langchain-core langchain langchain-openai  # add provider packages as needed
uv add --dev pytest pytest-asyncio

# Verify imports resolve
uv run python -c "from langchain_core.runnables import RunnablePassthrough; print('ok')"
uv run python -c "from langchain.chat_models import init_chat_model; print('ok')"

# Run type checking
uv run mypy src/ --strict

# Run tests
uv run pytest -x -q
```

For streaming verification:
```bash
uv run python -c "
import asyncio
from langchain.chat_models import init_chat_model

async def check():
    model = init_chat_model('openai:gpt-4o-mini')
    async for event in model.astream_events('hello', version='v2'):
        print(event['event'])
        break

asyncio.run(check())
"
```

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/runnables.md](references/runnables.md) | Full Runnable protocol, RunnableConfig fields, LCEL composition, astream_events versions | Research §1 |
| [references/chat-models.md](references/chat-models.md) | init_chat_model provider table, message types, content_blocks, with_structured_output | Research §2 |
| [references/prompts-output-parsers.md](references/prompts-output-parsers.md) | Prompts, hub.pull migration, output parsers, OutputFixingParser gotchas | Research §§3–4 |
| [references/loaders-splitters-embeddings.md](references/loaders-splitters-embeddings.md) | Document loaders, splitters, embeddings, CacheBackedEmbeddings | Research §§5–6 |
| [references/retrievers-callbacks.md](references/retrievers-callbacks.md) | Retrievers, EnsembleRetriever RRF, advanced retrievers, callbacks, tracing | Research §§7–8 |
| [references/migration.md](references/migration.md) | All deprecated → current API with code for both sides | Research §10 |

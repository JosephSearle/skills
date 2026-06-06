# Runnables Reference — LCEL Composition, RunnableConfig, astream_events

## The Runnable Protocol

All LCEL components implement `Runnable` (`from langchain_core.runnables import Runnable`). Every
Runnable exposes 9 methods with uniform signatures, declarative wrappers, and consistent
config propagation.

---

## Core Method Signatures

| Method | Signature | Returns | When to use |
|---|---|---|---|
| `invoke` | `invoke(input: Input, config: RunnableConfig \| None = None, **kwargs) -> Output` | `Output` | Single synchronous call |
| `ainvoke` | `async ainvoke(input, config=None, **kwargs) -> Output` | `Output` | Single async call |
| `stream` | `stream(input, config=None, **kwargs) -> Iterator[Output]` | `Iterator[Output]` | Sync token/chunk stream |
| `astream` | `astream(input, config=None, **kwargs) -> AsyncIterator[Output]` | `AsyncIterator[Output]` | Async token/chunk stream |
| `batch` | `batch(inputs: list[Input], config=None, *, return_exceptions=False, **kwargs) -> list[Output]` | `list[Output]` | Parallel sync calls (ThreadPoolExecutor; `max_concurrency` bounds it) |
| `abatch` | `async abatch(inputs, config=None, *, return_exceptions=False, **kwargs) -> list[Output]` | `list[Output]` | Parallel async calls |
| `batch_as_completed` | `batch_as_completed(inputs, config=None, **kwargs) -> Iterator[tuple[int, Output]]` | `Iterator[tuple[int, Output]]` | Yields `(index, output)` as each finishes — avoids buffering all results |
| `astream_log` | `astream_log(input, config=None, ...) -> AsyncIterator[RunLogPatch]` | `AsyncIterator[RunLogPatch]` | Low-level incremental run-state patches (older API; prefer `astream_events`) |
| `astream_events` | `astream_events(input, config=None, *, version="v2", include_names=None, include_types=None, include_tags=None, exclude_names=None, exclude_types=None, exclude_tags=None, **kwargs) -> AsyncIterator[StreamEvent]` | `AsyncIterator[StreamEvent]` | Structured event stream for UIs and observability |

### astream_events Version Table

| Version | Status | Notes |
|---|---|---|
| `"v1"` | Deprecated | Removal slated for 0.4.0; missing `parent_ids` |
| `"v2"` | Default (recommended) | Adds `parent_ids` (root→immediate); supports custom events via `dispatch_custom_event` |
| `"v3"` | Beta | Typed, content-block-centric; only implemented on `BaseChatModel` and `langgraph.CompiledGraph`; raises `NotImplementedError` on a generic Runnable |

### StreamEvent Schema

`StreamEvent` is a `TypedDict`:

| Field | Type | Notes |
|---|---|---|
| `event` | `str` | Format: `on_[type]_(start\|stream\|end)` — e.g. `on_chat_model_stream` |
| `name` | `str` | Runnable name (run_name or class name) |
| `run_id` | `str` | UUID of this run |
| `parent_ids` | `list[str]` | Root → immediate parent chain (v2+ only) |
| `tags` | `list[str]` | From RunnableConfig.tags |
| `metadata` | `dict[str, Any]` | From RunnableConfig.metadata |
| `data` | `dict` | `{"chunk": ...}` on stream events; `{"input": ..., "output": ...}` on end |

Runnable types in event names: `llm`, `chat_model`, `prompt`, `tool`, `chain`, `retriever`.

```python
from langchain_core.runnables import RunnableLambda
from langchain.chat_models import init_chat_model


async def stream_tokens_to_ui(question: str) -> None:
    model = init_chat_model("openai:gpt-4o-mini")
    async for event in model.astream_events(question, version="v2"):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if chunk.content:
                print(chunk.content, end="", flush=True)
        elif event["event"] == "on_chat_model_end":
            usage = event["data"]["output"].usage_metadata
            print(f"\n[tokens: {usage}]")


import asyncio
asyncio.run(stream_tokens_to_ui("Why is the sky blue?"))
```

---

## RunnableConfig — All Fields

`from langchain_core.runnables import RunnableConfig` — a `TypedDict(total=False)`.

### CONFIG_KEYS (all fields)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `tags` | `list[str]` | `[]` | Propagated to all callbacks and sub-calls; filterable in LangSmith |
| `metadata` | `dict[str, Any]` | `{}` | JSON-serializable; passed to `*_start` callback methods |
| `callbacks` | `Callbacks` | `None` | Handlers for this call and all sub-calls |
| `run_name` | `str` | class name | Tracer run name; **not** copied to children |
| `run_id` | `UUID \| None` | auto-generated | Tracer run id; **not** copied to children |
| `max_concurrency` | `int \| None` | `None` (executor default) | Max parallel calls in `batch` / `RunnableParallel` |
| `recursion_limit` | `int` | `25` | Max recursion depth for chains |
| `configurable` | `dict[str, Any]` | `{}` | Runtime values for fields exposed via `configurable_fields` / `configurable_alternatives` |

### COPIABLE_KEYS — Merged Into Children

`COPIABLE_KEYS = ("tags", "metadata", "callbacks", "configurable")` — these four fields are
deep-merged into every child Runnable's config at runtime. `run_name` and `run_id` are **not**
in `COPIABLE_KEYS`: each child gets its own auto-generated run_id and its own class name as
run_name. This is critical for building correct call trees in LangSmith.

| Key | Copied to children | Merge strategy |
|---|---|---|
| `tags` | Yes | List concatenation |
| `metadata` | Yes | Dict merge (parent wins on conflict) |
| `callbacks` | Yes | List concatenation |
| `configurable` | Yes | Dict merge |
| `run_name` | **No** | Each child uses its own class name |
| `run_id` | **No** | Each child gets a new UUID |
| `max_concurrency` | **No** | Only applies at the batch call site |
| `recursion_limit` | **No** | Decremented per recursive step |

```python
from langchain_core.runnables import RunnableConfig, RunnableLambda
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")

config: RunnableConfig = {
    "tags": ["prod", "rag"],
    "metadata": {"user_id": "u123", "session": "s456"},
    "run_name": "my-rag-chain",
    "max_concurrency": 4,
    "configurable": {"temperature": 0.2},
}

result = model.invoke("hello", config=config)
```

> **⚠️ Python <3.11:** `RunnableConfig` is propagated via a `ContextVar`
> (`var_child_runnable_config`). On Python <3.11 the context does **not** auto-propagate into
> `ainvoke` — you must thread `config` explicitly or callbacks and streaming silently break.
> Pin `requires-python = ">=3.11"` to avoid this.

---

## Declarative Wrappers

All wrappers return a `RunnableBinding` — a "decorator" that preserves batch/stream/async
semantics.

### with_config

```python
from langchain_core.runnables import RunnableLambda

def reverse(s: str) -> str:
    return s[::-1]

chain = RunnableLambda(reverse)
tagged = chain.with_config({"run_name": "reverser", "tags": ["prod"], "metadata": {"v": "2"}})
result = tagged.invoke("hello")
```

### with_retry

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")

robust_model = model.with_retry(
    retry_if_exception_type=(TimeoutError, ConnectionError),
    wait_exponential_jitter=True,
    stop_after_attempt=3,
)
```

> **Gotcha:** `with_retry` wraps a single Runnable. Place it on the **narrowest unit** (the
> model call), not the whole chain, so upstream side-effects (DB writes, tool calls) are not
> replayed on retry.

### with_fallbacks

```python
from langchain.chat_models import init_chat_model

primary = init_chat_model("openai:gpt-4o")
backup  = init_chat_model("anthropic:claude-haiku-4-5-20251001")

ha_model = primary.with_fallbacks(
    [backup],
    exceptions_to_handle=(Exception,),
)
```

> **Gotcha:** Fallbacks fire only on an **exception** from the primary — not on a "bad" but
> successful output. If you need semantic fallbacks (e.g. empty response), add a
> `RunnableLambda` guard before the fallback chain.

### with_listeners / with_alisteners

```python
from langchain_core.runnables import RunnableLambda
from langchain_core.tracers.schemas import Run


def on_start(run: Run) -> None:
    print(f"[START] {run.name} id={run.id}")


def on_end(run: Run) -> None:
    print(f"[END]   {run.name} output={run.outputs}")


def on_error(run: Run) -> None:
    print(f"[ERROR] {run.name} error={run.error}")


chain = RunnableLambda(str.upper).with_listeners(
    on_start=on_start,
    on_end=on_end,
    on_error=on_error,
)
chain.invoke("hello")
```

`Run` fields: `id`, `name`, `type`, `inputs`, `outputs`, `error`, `start_time`, `end_time`,
`tags`, `metadata`. `with_alisteners` is the async variant (handlers must be `async def`).

---

## Composition Primitives

### RunnableLambda

`from langchain_core.runnables import RunnableLambda`

Wraps any callable. Accepts both sync and async callables (`func=` / `afunc=`). If you pass a
**generator function**, the lambda becomes streaming-capable — chunks are yielded through
`.stream()` / `.astream()`. A callable accepting a second `config: RunnableConfig` parameter
receives the runtime config.

```python
from langchain_core.runnables import RunnableLambda, RunnableConfig


def upper_with_config(text: str, config: RunnableConfig) -> str:
    tag_str = ",".join(config.get("tags", []))
    return f"[{tag_str}] {text.upper()}"


chain = RunnableLambda(upper_with_config)
result = chain.invoke("hello", config={"tags": ["demo"]})
# "[demo] HELLO"


# Generator → streaming-capable
def chunk_words(text: str):
    for word in text.split():
        yield word + " "


streaming_chain = RunnableLambda(chunk_words)
for token in streaming_chain.stream("hello world foo"):
    print(token, end="")
```

### RunnableParallel

`from langchain_core.runnables import RunnableParallel, RunnablePassthrough`

Runs branches concurrently on the same input and merges results into a dict. A dict literal
inside a pipe is auto-coerced to `RunnableParallel`.

```python
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("Answer using context:\n{context}\n\nQuestion: {question}")


def fake_retriever(q: str) -> str:
    return "The sky is blue due to Rayleigh scattering."


# Dict literal auto-coerced to RunnableParallel
chain = (
    {"context": fake_retriever, "question": RunnablePassthrough()}
    | prompt
    | model
    | StrOutputParser()
)
result = chain.invoke("Why is the sky blue?")

# Explicit form — identical behaviour
mapper = RunnableParallel(context=fake_retriever, question=RunnablePassthrough())
chain2 = mapper | prompt | model | StrOutputParser()
```

### RunnableBranch

`from langchain_core.runnables import RunnableBranch`

Conditions evaluated top-to-bottom; first truthy `(condition, runnable)` wins; the final
positional arg is the mandatory default.

```python
from langchain_core.runnables import RunnableBranch, RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")

code_prompt    = ChatPromptTemplate.from_template("Answer the code question: {question}")
math_prompt    = ChatPromptTemplate.from_template("Solve the math problem: {question}")
general_prompt = ChatPromptTemplate.from_template("Answer: {question}")

code_chain    = code_prompt    | model | StrOutputParser()
math_chain    = math_prompt    | model | StrOutputParser()
general_chain = general_prompt | model | StrOutputParser()

router = RunnableBranch(
    (lambda x: "code" in x["topic"].lower(),  code_chain),
    (lambda x: "math" in x["topic"].lower(),  math_chain),
    general_chain,   # default — required
)

result = router.invoke({"topic": "code", "question": "What is a generator?"})
```

### RunnablePassthrough and .assign()

`from langchain_core.runnables import RunnablePassthrough`

Passes input through unchanged. `.assign(**kwargs)` adds keys to a dict-shaped input while
keeping all existing keys — each value is itself a Runnable (or callable) run on the full input.

```python
from langchain_core.runnables import RunnablePassthrough
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

model = init_chat_model("openai:gpt-4o-mini")


def retrieve(x: dict) -> str:
    return "Paris is the capital of France."


enriched = RunnablePassthrough.assign(
    context=lambda x: retrieve(x),
)

prompt = ChatPromptTemplate.from_template(
    "Context: {context}\nQuestion: {question}\nAnswer:"
)
chain = enriched | prompt | model | StrOutputParser()
result = chain.invoke({"question": "What is the capital of France?"})
```

### RunnableGenerator

`from langchain_core.runnables import RunnableGenerator`

Wraps a generator that transforms an **input iterator** into an **output iterator** — use for
custom streaming transforms (aggregating, filtering, or reshaping tokens mid-stream).

```python
from collections.abc import Iterator
from langchain_core.runnables import RunnableGenerator
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessageChunk


def uppercase_stream(chunks: Iterator[AIMessageChunk]) -> Iterator[str]:
    for chunk in chunks:
        if isinstance(chunk.content, str):
            yield chunk.content.upper()


model = init_chat_model("openai:gpt-4o-mini")
chain = model | RunnableGenerator(uppercase_stream)

for token in chain.stream("hello"):
    print(token, end="", flush=True)
```

---

## Pipe Operator Desugaring

`a | b | c` constructs `RunnableSequence(first=a, middle=[b], last=c)`. The equivalent
method form is `a.pipe(b, c)` or `RunnableSequence(first=a, middle=[b], last=c)`.

| Expression | Desugars to |
|---|---|
| `a \| b` | `RunnableSequence(first=a, last=b)` |
| `a \| b \| c` | `RunnableSequence(first=a, middle=[b], last=c)` |
| `{"k": r} \| b` | `RunnableSequence(first=RunnableParallel(k=r), last=b)` |
| `lambda x: x \| b` | `RunnableSequence(first=RunnableLambda(lambda x: x), last=b)` |
| `a.pipe(b, c)` | `RunnableSequence(first=a, middle=[b], last=c)` |

At runtime, `RunnableSequence.invoke` calls each step in order, threading the same config
(patched per-step with a fresh child `run_id`). Dict literals in a pipe are auto-coerced to
`RunnableParallel`; bare callables are auto-coerced to `RunnableLambda`.

> The LangChain team de-emphasizes large `|`-chains for **agentic** flows in favour of
> `create_agent`/LangGraph. LCEL remains the supported composition layer for deterministic
> pipelines.

---

## configurable_fields — Runtime Parameter Switching

`ConfigurableField` exposes named fields for runtime override via `RunnableConfig.configurable`.

```python
from langchain_core.runnables import ConfigurableField
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini", temperature=0)

# Expose temperature and model as runtime-configurable
configurable_model = model.configurable_fields(
    temperature=ConfigurableField(
        id="temperature",
        name="Model temperature",
        description="Sampling temperature 0–2",
    )
)

# Override at call time
result = configurable_model.invoke(
    "Tell me a joke",
    config={"configurable": {"temperature": 0.9}},
)
```

For full provider+model switching, use `init_chat_model` with `configurable_fields="any"` —
see `references/chat-models.md` §configurable_fields.

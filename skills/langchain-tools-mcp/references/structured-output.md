# Structured Output Reference — with_structured_output, Strategies, Strict Mode, Pydantic, Streaming

## Strategy Selection

| Strategy | Mechanism | Auto-selected when | Explicit class |
|---|---|---|---|
| `ProviderStrategy` | Native provider structured output (JSON schema → CFG/FSM constrained decoding) | Model profile supports native structured output (OpenAI, Anthropic, xAI/Grok, Gemini) | `langchain.agents.structured_output.ProviderStrategy` |
| `ToolStrategy` | Wraps schema as a tool; forces a tool call to extract data | Model lacks native structured output support | `langchain.agents.structured_output.ToolStrategy` |
| JSON mode | Provider JSON mode (valid JSON, schema not strictly enforced) | Explicitly requested via `method="json_mode"` | Via `with_structured_output(method="json_mode")` |

**Auto-selection rule:** Pass a bare `type[T]` schema to `create_agent(response_format=...)`.
LangChain reads the model **profile** (`langchain>=1.1`) and selects `ProviderStrategy` if
supported, else `ToolStrategy`. The result lands in `result["structured_response"]`.

### Strategy Comparison

| Dimension | `ToolStrategy` | `ProviderStrategy` | JSON mode |
|---|---|---|---|
| Compatibility | Any tool-capable model | OpenAI, Anthropic, xAI, Gemini | Models with JSON mode enabled |
| Reliability | Good; self-corrects via error feedback loop | Highest; schema strictly enforced at decode time | Valid JSON guaranteed; schema adherence weak |
| Union support | Yes — model picks from `Union[A, B]` members | Restricted under strict (no root `oneOf`) | Not enforced |
| Complex/nested schemas | Can struggle on very complex schemas | High reliability; schema limit caveats apply | Not enforced |
| Retry behaviour | Auto-retry on validation failure via `handle_errors` | Schema violation impossible (constrained decoding) | Manual retry needed |
| Latency/cost | Extra tool round-trips on retry | Lowest — one constrained generation | Low |
| Key pitfalls | Loops on repeated failure; Anthropic thinking + tool_choice 400 | Schema restrictions (strict mode); `400 Schema is too complex` on complex schemas | No hard schema guarantee |

---

## CRITICAL: Known Failure Modes

### `ProviderStrategy` — Schema Too Complex

> **`400 Schema is too complex for grammar compilation`**

Some providers compile the Pydantic schema into a context-free grammar (CFG) or finite
state machine (FSM) for constrained decoding. Highly nested schemas, schemas with many
`Union` branches, or schemas with very large `Literal` enums can exceed the compilation
limit and return this 400 error.

**Mitigations:**
1. Simplify the schema — split large extractions into multiple smaller tool calls
2. Reduce `Union` branches — use a discriminated union with a `type` field instead of a
   bare `Union[A, B, C, D]`
3. Switch to `ToolStrategy` which does not compile schemas into grammars
4. Use `include_raw=True` to debug which schema feature triggers the error

### Anthropic Thinking + `ToolStrategy` Conflict

> **`400 Thinking may not be enabled when tool_choice forces tool use`**

`ToolStrategy` forces `tool_choice` to require the structured-output tool call. When
Anthropic extended thinking is enabled on the same model invocation, the API rejects this
combination — thinking cannot be active while `tool_choice` forces a specific tool.

**Mitigations:**
1. Use a manual `model_validate` retry loop instead of `ToolStrategy`
2. Disable thinking for the structured-output step
3. Use `ProviderStrategy` (which does not set `tool_choice`)

---

## `create_agent` with `response_format`

```python
from pydantic import BaseModel, Field
from typing import Literal
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy, ProviderStrategy

class ProductReview(BaseModel):
    """Analysis of a single product review."""
    rating: int | None = Field(description="Star rating 1-5, or null if not stated", ge=1, le=5)
    sentiment: Literal["positive", "negative", "neutral"]
    key_points: list[str] = Field(description="Key observations from the review")
    verified_purchase: bool | None = Field(description="True/False/null if unknown")

# Auto-select strategy (recommended starting point)
agent = create_agent("gpt-4o", tools=[], response_format=ProductReview)

# Explicit ProviderStrategy with strict schema enforcement (OpenAI/langchain>=1.2)
agent = create_agent(
    "gpt-4o",
    tools=[],
    response_format=ProviderStrategy(ProductReview, strict=True),
)

# Explicit ToolStrategy with custom error message for retry
agent = create_agent(
    "claude-sonnet-4-6",
    tools=[],
    response_format=ToolStrategy(
        ProductReview,
        handle_errors="Invalid review structure. Provide a valid 1-5 rating and one of: positive, negative, neutral.",
    ),
)

result = await agent.ainvoke({
    "messages": [{
        "role": "user",
        "content": "Analyze: 'Great product 5 stars, fast shipping but packaging was damaged'",
    }]
})
parsed: ProductReview = result["structured_response"]
print(parsed.rating, parsed.sentiment, parsed.key_points)
```

---

## `with_structured_output` — Direct Usage

```python
from pydantic import BaseModel, Field
from typing import Literal
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

class Invoice(BaseModel):
    vendor: str = Field(description="Vendor name from invoice header")
    amount: float = Field(description="Total amount due in USD")
    due_date: str = Field(description="Payment due date as ISO 8601 string")
    line_items: list[str] = Field(description="Individual line item descriptions")

# OpenAI — function_calling (ToolStrategy equivalent)
llm = ChatOpenAI(model="gpt-4o")
structured = llm.with_structured_output(Invoice, method="function_calling")
invoice = structured.invoke("Extract invoice data from: ...")

# OpenAI — json_schema (ProviderStrategy equivalent, with optional strict)
structured_strict = llm.with_structured_output(Invoice, method="json_schema", strict=True)

# OpenAI — json_mode
structured_json = llm.with_structured_output(Invoice, method="json_mode")

# Anthropic — function_calling (forced tool call)
llm_claude = ChatAnthropic(model="claude-sonnet-4-6")
structured_claude = llm_claude.with_structured_output(Invoice, method="function_calling")

# include_raw=True — returns dict with raw AIMessage, parsed object, and parse error
structured_raw = llm.with_structured_output(Invoice, include_raw=True)
raw_result = structured_raw.invoke("Extract invoice: ...")
# raw_result = {"raw": AIMessage(...), "parsed": Invoice(...), "parsing_error": None}
```

### `method` Parameter Values

| Value | Strategy equivalent | Notes |
|---|---|---|
| `"function_calling"` | `ToolStrategy` | Works on any tool-capable model |
| `"json_schema"` | `ProviderStrategy` | Provider native structured output |
| `"json_mode"` | JSON mode | Valid JSON, weak schema adherence |

---

## `include_raw=True` — Debugging

Use `include_raw=True` while developing or when debugging unexpected parse failures:

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

class ExtractedEntity(BaseModel):
    name: str = Field(description="Entity name")
    entity_type: str = Field(description="Person, Organization, Location, etc.")
    confidence: float = Field(ge=0.0, le=1.0, description="Extraction confidence 0-1")

llm = ChatOpenAI(model="gpt-4o")
structured = llm.with_structured_output(ExtractedEntity, include_raw=True)
result = structured.invoke("Extract: 'OpenAI is based in San Francisco.'")

raw_message = result["raw"]          # AIMessage with full tool call or JSON content
parsed_entity = result["parsed"]     # ExtractedEntity instance, or None on failure
parse_error = result["parsing_error"]  # Exception | None

if parse_error:
    print(f"Parse failed: {parse_error}")
    print(f"Raw content: {raw_message.content}")
else:
    print(f"Extracted: {parsed_entity}")
```

---

## OpenAI Strict Mode — Schema Requirements

`strict=True` enables constrained decoding (token-level schema enforcement) but imposes
hard schema constraints:

| Requirement | Compliant | Non-compliant |
|---|---|---|
| All properties in `required` | `x: str \| None` in `required` | `x: str = "default"` (no defaults) |
| Optional fields as nullable union | `x: str \| None = None` | `Optional[str]` without explicit None value |
| No `additionalProperties` | Automatic with Pydantic strict config | Open schemas |
| No root `oneOf` | Nested `Union` fields | `Union[ModelA, ModelB]` at root level |
| No default values | `x: str \| None = None` only | `x: str = "default"` |
| datetime fields | ISO 8601 strings (`x: str`) | `datetime.datetime` objects |

> **OpenAI strict-mode limits raised July 2025:** Historical caps of 100 properties / 5
> nesting levels were raised to approximately 5,000 object properties and 1,000 enum values.
> Verify the current ceiling against live OpenAI platform docs — these limits may change.
> Pin model versions (e.g., `gpt-4o-2024-08-06`+); aliases may silently fall back to
> plain JSON mode behavior.

```python
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.agents.structured_output import ProviderStrategy
from langchain.agents import create_agent

class StrictExtractionResult(BaseModel):
    """Strict-mode compliant schema for OpenAI constrained decoding."""
    model_config = {"extra": "forbid"}   # additionalProperties: false

    title: str | None = Field(description="Document title, null if not found")
    author: str | None = Field(description="Author name, null if not found")
    published_year: int | None = Field(description="Publication year as integer, null if unknown")
    summary: str | None = Field(description="2-3 sentence summary, null if insufficient content")
    topics: list[str] = Field(default_factory=list, description="Key topic tags")

agent = create_agent(
    "gpt-4o",
    tools=[],
    response_format=ProviderStrategy(StrictExtractionResult, strict=True),
)
result = await agent.ainvoke({"messages": [{"role": "user", "content": "Extract metadata from: ..."}]})
extracted: StrictExtractionResult = result["structured_response"]
```

---

## Pydantic v2 Integration Gotchas

| Gotcha | Cause | Fix |
|---|---|---|
| Provider strict mode rejects schema | Optional field not expressed as nullable union | Change `x: Optional[str]` to `x: str \| None = None` |
| `Union` at root fails provider strict mode | Root-level `oneOf` not allowed | Use discriminated union: add `type: Literal["a"]` field |
| Nested `BaseModel` breaks on some providers | Deep nesting exceeds grammar compilation limits | Flatten schema or use `ToolStrategy` |
| `datetime` field rejected in strict mode | `datetime` not a JSON primitive | Use `str` and document ISO 8601 format in `Field(description=...)` |
| `model_validate` returns wrong type | `from_orm` vs `model_validate` confusion (Pydantic v2) | Use `MyModel.model_validate(data)` for dict input |
| `ValidationError` on agent output | Schema constraint violated | Let `ToolStrategy.handle_errors` retry, or catch manually |
| Schema with many `list[SomeModel]` members | Exponential grammar expansion | Cap list lengths or split into sub-calls |

### Strict-Mode Compatible Schema Pattern

```python
from pydantic import BaseModel, Field
from typing import Literal

class LineItem(BaseModel):
    """Individual line item in an invoice."""
    model_config = {"extra": "forbid"}

    description: str | None = Field(description="Item description")
    quantity: int | None = Field(description="Quantity, null if not specified", ge=1)
    unit_price: float | None = Field(description="Price per unit in USD, null if not specified")
    total: float | None = Field(description="Line total in USD, null if not computed")

class ExtractedInvoice(BaseModel):
    """Complete invoice extraction result."""
    model_config = {"extra": "forbid"}

    vendor_name: str | None = Field(description="Vendor company name")
    invoice_number: str | None = Field(description="Invoice/document number")
    issue_date: str | None = Field(description="Issue date as ISO 8601 string")
    due_date: str | None = Field(description="Payment due date as ISO 8601 string")
    subtotal: float | None = Field(description="Pre-tax total in USD")
    tax_amount: float | None = Field(description="Tax amount in USD")
    total_due: float | None = Field(description="Total amount due in USD")
    line_items: list[LineItem] = Field(default_factory=list, description="Line items")
    currency: str | None = Field(description="3-letter ISO currency code, e.g. USD")
```

---

## ToolStrategy Retry Behaviour

`ToolStrategy(handle_errors=...)` controls retries on validation/call failures:

| `handle_errors` value | Behaviour |
|---|---|
| `True` (default) | Retry all failures with a default error message |
| `"custom message"` | Retry with that fixed string as the error observation |
| `(ValueError, KeyError)` | Retry only those exception types; re-raise others |
| `lambda exc: f"Fix: {exc}"` | Retry with the callable's return string |
| `False` | Raise immediately — no retry |

On validation failure, the agent appends an error `ToolMessage` (e.g., `"Input should be
less than or equal to 5"`) and re-prompts. On multiple structured-output tool calls in one
turn, it raises `MultipleStructuredOutputsError` and re-prompts. Both feed back into the
agent loop rather than crashing the run.

---

## Manual Retry Loop (for Anthropic thinking + ToolStrategy conflicts)

When `ToolStrategy` cannot be used (e.g., Anthropic extended thinking), implement manual retry:

```python
import asyncio
from pydantic import BaseModel, ValidationError
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage
import json

class AnalysisResult(BaseModel):
    summary: str
    confidence: float
    recommendations: list[str]

async def extract_with_retry(
    text: str,
    max_retries: int = 3,
) -> AnalysisResult:
    """Manual structured output with retry, compatible with Anthropic thinking mode."""
    llm = ChatAnthropic(model="claude-sonnet-4-6")

    system = (
        "You are an analysis assistant. Respond ONLY with valid JSON matching this schema:\n"
        + AnalysisResult.model_json_schema().__repr__()
    )
    messages: list = [HumanMessage(content=f"Analyze: {text}")]

    for attempt in range(max_retries):
        resp = await llm.ainvoke([("system", system)] + messages)
        try:
            # Extract JSON from response content
            content = resp.content
            if isinstance(content, list):
                # Handle content blocks
                content = " ".join(
                    block["text"] for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                )
            # Parse and validate
            data = json.loads(content)
            return AnalysisResult.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == max_retries - 1:
                raise
            messages.append(resp)
            messages.append(HumanMessage(
                content=f"Your response was invalid: {exc}. Respond with valid JSON only."
            ))

    raise RuntimeError("unreachable")
```

---

## Streaming Structured Output

```python
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

class StreamingExtract(BaseModel):
    title: str = Field(description="Document title")
    key_points: list[str] = Field(description="Key points extracted")

llm = ChatOpenAI(model="gpt-4o", temperature=0)
parser = JsonOutputParser()

chain = llm | parser

# Streaming — yields partial JSON objects as keys accumulate
async def stream_extraction(text: str) -> StreamingExtract:
    partial_result = {}
    async for chunk in chain.astream(
        f"Extract title and key_points as JSON from: {text}"
    ):
        partial_result = chunk          # each chunk is a partial JSON dict

    # Only validate the final, complete object
    return StreamingExtract.model_validate(partial_result)

# With diff=True — yields JSONPatch deltas instead of full partial objects
# parser_diff = JsonOutputParser(diff=True)
```

> **Streaming note:** `PydanticOutputParser` is designed for terminal validation (not
> incremental streaming). Use `JsonOutputParser` for streaming, then validate the final
> accumulated object with `YourModel.model_validate(result)`.

> **Malformed partials during streaming are expected.** Buffer tokens until you have a valid
> balanced JSON object, then parse. Never act on a mid-stream partial.

---

## `OutputFixingParser`

Wraps any parser; on parse failure, re-prompts an LLM to repair the malformed output:

```python
from langchain.output_parsers import OutputFixingParser
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import ChatOpenAI

base_parser = JsonOutputParser()
fixing_parser = OutputFixingParser.from_llm(
    parser=base_parser,
    llm=ChatOpenAI(model="gpt-4o-mini"),   # cheaper model for repairs
    max_retries=3,
)

# Will attempt to fix malformed JSON before raising
parsed = fixing_parser.parse('{"title": "My Doc", "points": ["a", "b"')  # missing closing
```

### When `OutputFixingParser` Helps vs Hurts

| Use `OutputFixingParser` | Avoid `OutputFixingParser` |
|---|---|
| Parsing legacy/external LLM output you can't control | Inside a `create_agent` / `ToolStrategy` path — built-in retry is better |
| One-shot chains where agent retry loop is unavailable | When parse failure indicates a fundamental schema mismatch |
| Repairing genuinely minor formatting errors (extra text, truncation) | Complex structural failures — fixing LLM often produces different structural errors |
| Budget allows extra LLM call for correction | Latency-sensitive paths where extra LLM call is unacceptable |

> **`OutputFixingParser` cannot wrap `with_structured_output`.** `with_structured_output`
> returns a `Runnable` chain, not a `BaseOutputParser`; `OutputFixingParser.from_llm` requires
> a `BaseOutputParser`. Use `ToolStrategy(handle_errors=...)` for equivalent retry within
> `create_agent`, or implement a manual retry loop.

---

## Version Notes

> **`ProviderStrategy(strict=True)` requires `langchain>=1.2`.**

> **Auto-selection from model profile requires `langchain>=1.1`** — on older versions, bare
> schema type defaults to `ToolStrategy` regardless of model capabilities.

> **`MultipleStructuredOutputsError`** is raised when the model emits more than one
> structured-output tool call in a single response — the agent feeds this back and re-prompts.

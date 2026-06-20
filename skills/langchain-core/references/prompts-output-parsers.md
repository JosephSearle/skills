# Prompts & Output Parsers Reference — ChatPromptTemplate, MessagesPlaceholder, hub.pull Migration, Parsers

## ChatPromptTemplate

`from langchain_core.prompts import ChatPromptTemplate`

### Constructor methods

| Method | Signature | Use when |
|---|---|---|
| `from_messages(messages)` | `list[tuple\|BaseMessage\|MessagesPlaceholder]` | Multi-turn chat with role tuples |
| `from_template(template)` | `str` | Single human message shorthand |
| `from_template(template, role="system")` | `str, role` | Single-role message |
| `partial(**kwargs)` | keyword args → str or `Callable[[], str]` | Pre-bind variables at construction time |
| `format_messages(**kwargs)` | keyword args | Returns `list[BaseMessage]` |
| `invoke(input: dict)` | `dict` | Returns `PromptValue` (Runnable-compatible) |

### Role tuple format

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage

# Tuple form: (role, template_string)
# role ∈ "system" | "human" | "ai" | "assistant" | "user"
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful {role}. Today is {date}."),
    MessagesPlaceholder("history", optional=True, n_messages=10),
    ("human", "{question}"),
])

# format_messages resolves all variables
messages = prompt.format_messages(
    role="data scientist",
    date="2026-06-06",
    question="How do I compute a p-value?",
    history=[],
)

# invoke for LCEL pipe integration
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser

model = init_chat_model("openai:gpt-4o-mini")
chain = prompt | model | StrOutputParser()
result = chain.invoke({
    "role": "data scientist",
    "date": "2026-06-06",
    "question": "How do I compute a p-value?",
})
```

### MessagesPlaceholder

`from langchain_core.prompts import MessagesPlaceholder`

```python
MessagesPlaceholder(
    variable_name: str,
    *,
    optional: bool = False,
    n_messages: int | None = None,
)
```

| Parameter | Type | Notes |
|---|---|---|
| `variable_name` | `str` | Key in the input dict |
| `optional` | `bool` | If `True`, missing key is silently treated as empty list |
| `n_messages` | `int \| None` | Truncates to the last N messages — prevents context overflow |

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    MessagesPlaceholder("history", optional=True, n_messages=20),
    ("human", "{question}"),
])

history = [
    HumanMessage("What is the capital of France?"),
    AIMessage("Paris."),
]

messages = prompt.format_messages(question="And of Germany?", history=history)
```

### partial() — Pre-bound variables

`partial` accepts literal values or **zero-argument callables** (evaluated lazily at format time).

```python
from datetime import datetime
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Current time: {time}."),
    ("human", "{question}"),
])

# Lazy callable — evaluated each time the prompt is formatted
prompt_with_time = prompt.partial(time=lambda: datetime.now().isoformat())

# At format time, `time` is injected automatically
messages = prompt_with_time.format_messages(question="What time zone should I use?")
```

---

## FewShotChatMessagePromptTemplate

`from langchain_core.prompts import FewShotChatMessagePromptTemplate`

Renders few-shot examples into the message list before the final user turn.

```python
from langchain_core.prompts import (
    ChatPromptTemplate,
    FewShotChatMessagePromptTemplate,
)
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import StrOutputParser

examples = [
    {"input": "2 + 2", "output": "4"},
    {"input": "What is the capital of Japan?", "output": "Tokyo"},
]

example_prompt = ChatPromptTemplate.from_messages([
    ("human", "{input}"),
    ("ai", "{output}"),
])

few_shot_prompt = FewShotChatMessagePromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
)

final_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Answer concisely."),
    few_shot_prompt,
    ("human", "{question}"),
])

model = init_chat_model("openai:gpt-4o-mini")
chain = final_prompt | model | StrOutputParser()
result = chain.invoke({"question": "What is 8 * 7?"})
```

---

## hub.pull Migration

### OLD — hub.pull (deprecated, moved to langchain-classic)

```python
# OLD — requires langchain-classic; not recommended for new code
from langchain_classic import hub

prompt = hub.pull("langchain-ai/retrieval-qa-chat")
prompt_at_commit = hub.pull("joke-generator:a1b2c3d4")
prompt_at_tag = hub.pull("joke-generator:production")

# Push
hub.push("my-org/my-prompt", prompt)
```

### NEW — LangSmith Client (recommended)

```python
from langsmith import Client

client = Client()  # reads LANGSMITH_API_KEY from environment

# Pull latest
prompt = client.pull_prompt("langchain-ai/retrieval-qa-chat")

# Pull by tag
prompt_tagged = client.pull_prompt("joke-generator:production")

# Pull by commit hash
prompt_commit = client.pull_prompt("joke-generator:a1b2c3d4")

# Push
client.push_prompt("my-org/my-prompt", object=prompt)
```

> **Gotcha:** `pull_prompt` and `hub.pull` both require `LANGSMITH_API_KEY`. A known LangSmith
> SDK issue (langsmith-sdk #1624) shows the env var isn't always auto-detected — if calls fail
> silently, pass the key explicitly: `Client(api_key=os.environ["LANGSMITH_API_KEY"])`.

### Migration table

| Old | New |
|---|---|
| `from langchain import hub` | `from langsmith import Client; client = Client()` |
| `from langchain_classic import hub` | `from langsmith import Client; client = Client()` |
| `hub.pull("owner/name")` | `client.pull_prompt("owner/name")` |
| `hub.pull("name:tag")` | `client.pull_prompt("name:tag")` |
| `hub.pull("name:commit")` | `client.pull_prompt("name:commit")` |
| `hub.push("name", prompt)` | `client.push_prompt("name", object=prompt)` |

---

## Output Parsers

`from langchain_core.output_parsers import (StrOutputParser, JsonOutputParser,
PydanticOutputParser, CommaSeparatedListOutputParser, JsonOutputKeyToolsParser)`

All parsers derive from `BaseOutputParser`, are Runnables (drop into a pipe), and expose
`get_format_instructions()`.

### Parser comparison table

| Parser | Import | Output type | Use when |
|---|---|---|---|
| `StrOutputParser` | `langchain_core.output_parsers` | `str` | Extract `.content` text; most chains |
| `JsonOutputParser` | `langchain_core.output_parsers` | `dict` | Streams incrementally-built partial JSON; weak models |
| `PydanticOutputParser` | `langchain_core.output_parsers` | Pydantic instance | Typed output from models without native structured output |
| `CommaSeparatedListOutputParser` | `langchain_core.output_parsers` | `list[str]` | Simple enumeration extraction |
| `JsonOutputKeyToolsParser` | `langchain_core.output_parsers` | varies | Extract a specific tool-call key; stream structured data |
| `OutputFixingParser` | `langchain_classic.output_parsers` | same as wrapped | Retry malformed output via LLM re-prompt; see gotchas |

### StrOutputParser

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("Tell me a joke about {topic}.")

chain = prompt | model | StrOutputParser()
result: str = chain.invoke({"topic": "Python"})
```

### PydanticOutputParser

```python
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
from langchain.chat_models import init_chat_model
from pydantic import BaseModel, Field

class Joke(BaseModel):
    setup: str = Field(description="The setup of the joke")
    punchline: str = Field(description="The punchline")

parser = PydanticOutputParser(pydantic_object=Joke)

prompt = PromptTemplate(
    template="Answer the user query.\n{format_instructions}\n{query}\n",
    input_variables=["query"],
    partial_variables={"format_instructions": parser.get_format_instructions()},
)

model = init_chat_model("openai:gpt-4o-mini")
chain = prompt | model | parser

joke: Joke = chain.invoke({"query": "Tell me a joke about programming."})
print(joke.setup)
print(joke.punchline)
```

> `PydanticOutputParser.parse(text)` validates and returns an instance; raises
> `OutputParserException` on failure.

### JsonOutputParser (streaming-capable)

```python
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")

prompt = PromptTemplate.from_template(
    "Return a JSON object with 'name' and 'age' for a fictional person named {name}. "
    "Output ONLY valid JSON."
)

chain = prompt | model | JsonOutputParser()

# Streams incrementally-built partial dicts
for partial in chain.stream({"name": "Alice"}):
    print(partial)
```

### JsonOutputKeyToolsParser

```python
from langchain_core.output_parsers import JsonOutputKeyToolsParser
from langchain_core.tools import tool
from langchain.chat_models import init_chat_model


@tool
def search(query: str) -> str:
    """Search the web."""
    return "results"


model = init_chat_model("openai:gpt-4o-mini").bind_tools([search])
parser = JsonOutputKeyToolsParser(key_name="search", first_tool_only=True)
chain = model | parser

for partial_args in chain.stream("Search for LangChain tutorials"):
    print(partial_args)
```

### OutputFixingParser — Gotchas

`from langchain_classic.output_parsers import OutputFixingParser`

```python
from langchain_classic.output_parsers import OutputFixingParser
from langchain_core.output_parsers import PydanticOutputParser
from langchain.chat_models import init_chat_model
from pydantic import BaseModel


class Joke(BaseModel):
    setup: str
    punchline: str


base_parser = PydanticOutputParser(pydantic_object=Joke)
model = init_chat_model("openai:gpt-4o-mini")

# Wraps the base parser and re-prompts the LLM to repair malformed output
fixing_parser = OutputFixingParser.from_llm(parser=base_parser, llm=model)
```

| Scenario | OutputFixingParser | Recommendation |
|---|---|---|
| Weak model produces near-miss JSON | Helps — re-prompt usually fixes it | Acceptable fallback |
| Strong model with nearly-valid output | Makes things worse — extra latency/cost; can loop | Use `with_structured_output(strict=True)` instead |
| Wrapping `with_structured_output` | **Cannot** — parse error occurs inside that Runnable | Use `include_raw=True` on `with_structured_output` |
| Models with native structured output | Unnecessary | Always prefer `with_structured_output` |

---

## Why Structured Output Beats Parsers

| Factor | `with_structured_output` | `PydanticOutputParser` |
|---|---|---|
| Schema guarantee | Constrained decoding (CFG→FSM); 100% structural validity | Prompt injection; LLM may deviate |
| Prompt drift | None — no format instructions injected | Format instructions must be kept in sync with schema |
| Typing | Typed return directly from the chain | Same, but via text round-trip |
| Streaming | Native streaming of structured chunks | Streams text; parse only at end |
| Models without native support | Falls back to `function_calling` | Works on any model |

**Rule:** use `with_structured_output` for all new code. Reserve `PydanticOutputParser` for
models that genuinely lack structured-output capability.

# AWS Bedrock Reference — langchain-aws 1.5.0

> **Install:**
> ```bash
> uv add langchain-aws==1.5.0
>
> # For ChatAnthropicBedrock (extends ChatAnthropic via Anthropic SDK Bedrock client):
> uv add "langchain-aws[anthropic]==1.5.0"
> ```

---

## Class Selection: ChatBedrockConverse vs ChatBedrock

| Class | API route | Recommended? | Use case |
|---|---|---|---|
| `ChatBedrockConverse` | Bedrock Converse API | **YES — default choice** | All standard models; unified interface |
| `ChatBedrock` | Bedrock legacy invoke_model | Only when required | Custom/provisioned models not yet on Converse |
| `ChatAnthropicBedrock` | Anthropic SDK Bedrock client | Yes for Claude parity | Needs identical API to `ChatAnthropic`; requires `langchain-aws[anthropic]` |

> **⚠️ Use ChatBedrockConverse, not ChatBedrock.** `ChatBedrockConverse` is the recommended
> class for all production use. `ChatBedrock` (legacy invoke route) is required only for custom
> or provisioned throughput models that the Converse API does not yet support.

---

## Cross-Region Inference Profiles

> **⚠️ Cross-region inference is REQUIRED for most current models.** Calling the bare model ID
> (e.g. `anthropic.claude-sonnet-4-6`) returns _"on-demand throughput isn't supported"_.
> Use inference profile IDs with `us.` / `eu.` / `apac.` prefixes.

### Naming convention

| Format | Example |
|---|---|
| Bare model ID (do NOT use for new models) | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| US cross-region inference profile | `us.anthropic.claude-sonnet-4-6` |
| EU cross-region inference profile | `eu.anthropic.claude-sonnet-4-6` |
| APAC cross-region inference profile | `apac.anthropic.claude-sonnet-4-6` |

### Common inference profile IDs (June 2026)

| Model | US profile | EU profile |
|---|---|---|
| Claude Sonnet 4.6 | `us.anthropic.claude-sonnet-4-6` | `eu.anthropic.claude-sonnet-4-6` |
| Claude Haiku 4.5 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | `eu.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Amazon Nova Pro | `us.amazon.nova-pro-v1:0` | — |
| Amazon Nova Lite | `us.amazon.nova-lite-v1:0` | — |
| Amazon Nova Micro | `us.amazon.nova-micro-v1:0` | — |

---

## ChatBedrockConverse — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model_id` | `str` | required | Bedrock model or inference profile ID |
| `region_name` | `str \| None` | `None` | AWS region; falls back to `AWS_REGION` env |
| `aws_access_key_id` | `str \| None` | `None` | Overrides env chain |
| `aws_secret_access_key` | `str \| None` | `None` | Overrides env chain |
| `aws_session_token` | `str \| None` | `None` | For assumed roles / STS |
| `credentials_profile_name` | `str \| None` | `None` | Named profile from `~/.aws/credentials` |
| `client` | `BaseClient \| None` | `None` | Inject a pre-built boto3 client |
| `config` | `botocore.config.Config \| None` | `None` | botocore Config; also controls connect/read timeouts |
| `max_retries` | `int` | `2` | AWS SDK retries |
| `temperature` | `float \| None` | `None` | Sampling temperature |
| `max_tokens` | `int \| None` | `None` | Max output tokens |
| `stop_sequences` | `list[str] \| None` | `None` | Stop sequences |
| `provider` | `str \| None` | `None` | Provider hint for ARN/custom/provisioned models lacking a provider prefix |
| `guardrails` | `dict \| None` | `None` | `{"guardrailIdentifier": "...", "guardrailVersion": "...", "trace": "enabled"}` |
| `additional_model_request_fields` | `dict \| None` | `None` | Pass-through for model-specific params (thinking, caching, beta headers) |

---

## Auth — boto3 Credential Chain

The boto3 credential chain is checked in order:

| Priority | Source |
|---|---|
| 1 | `AWS_BEARER_TOKEN_BEDROCK` env var (API key — takes precedence over AWS creds) |
| 2 | `aws_access_key_id` / `aws_secret_access_key` / `aws_session_token` constructor params |
| 3 | `credentials_profile_name` constructor param → named profile |
| 4 | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` env vars |
| 5 | `~/.aws/credentials` default profile |
| 6 | EC2/ECS/Lambda instance profile / IAM role |

---

## ChatBedrockConverse — Examples

### Basic usage

```python
from langchain_aws import ChatBedrockConverse

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-west-2",
    temperature=0,
    max_tokens=2048,
)

response = llm.invoke("Explain the CAP theorem in one paragraph.")
print(response.text)
```

### Named profile auth

```python
from langchain_aws import ChatBedrockConverse

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-east-1",
    credentials_profile_name="production",
    max_tokens=2048,
)
```

### IAM role assumption (injected boto3 client)

```python
import boto3
from langchain_aws import ChatBedrockConverse

sts = boto3.client("sts", region_name="us-west-2")
assumed = sts.assume_role(
    RoleArn="arn:aws:iam::123456789012:role/BedrockRole",
    RoleSessionName="langchain-session",
)
creds = assumed["Credentials"]

bedrock_client = boto3.client(
    "bedrock-runtime",
    region_name="us-west-2",
    aws_access_key_id=creds["AccessKeyId"],
    aws_secret_access_key=creds["SecretAccessKey"],
    aws_session_token=creds["SessionToken"],
)

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    client=bedrock_client,
)
```

### Extended thinking via additional_model_request_fields

```python
from langchain_aws import ChatBedrockConverse

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-west-2",
    max_tokens=8192,
    additional_model_request_fields={
        "thinking": {"type": "enabled", "budget_tokens": 2048}
    },
)

response = llm.invoke("Solve step by step: integral of x^2 from 0 to 3")
print(response.text)
```

### Prompt caching via cachePoint blocks

```python
from langchain_aws import ChatBedrockConverse
from langchain_core.messages import SystemMessage, HumanMessage

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-west-2",
    max_tokens=1024,
)

# cachePoint instructs Bedrock to cache the preceding content block
messages = [
    SystemMessage(content=[
        {"text": "You are a helpful assistant. " + "x" * 5000},
        {"cachePoint": {"type": "default"}},  # cache the system prompt
    ]),
    HumanMessage(content="Summarise your role."),
]

response = llm.invoke(messages)
print(response.text)
```

### Tool calling

```python
from langchain_aws import ChatBedrockConverse
from langchain_core.tools import tool


@tool
def get_stock_price(ticker: str) -> float:
    """Get the current stock price for a ticker symbol."""
    return 42.0


llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-west-2",
    max_tokens=1024,
)
llm_with_tools = llm.bind_tools([get_stock_price])
response = llm_with_tools.invoke("What is the stock price of AAPL?")
for tc in response.tool_calls:
    print(tc["name"], tc["args"])
```

### Fine-grained streaming (Claude 4.5+)

```python
from langchain_aws import ChatBedrockConverse

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-west-2",
    max_tokens=2048,
    additional_model_request_fields={
        "anthropic_beta": ["fine-grained-tool-streaming-2025-05-14"]
    },
)
```

> **⚠️ Fine-grained streaming partial JSON:** The fine-grained tool streaming beta
> (`fine-grained-tool-streaming-2025-05-14`) on Claude 4.5+ may emit partial/invalid JSON
> in streaming chunks — validate or buffer before parsing.

---

## ChatAnthropicBedrock

`ChatAnthropicBedrock` extends `ChatAnthropic` using the Anthropic SDK's native Bedrock client.
Use it when you want identical API behaviour to direct Anthropic (`ChatAnthropic`) but routed
through Bedrock for compliance, cost, or region requirements.

```python
from langchain_aws import ChatAnthropicBedrock

# model uses Bedrock inference profile ID format
llm = ChatAnthropicBedrock(
    model="us.anthropic.claude-haiku-4-5-20251001-v1:0",
    region_name="us-west-2",
    max_tokens=1024,
)

response = llm.invoke("What is the capital of France?")
print(response.text)
```

### ChatAnthropicBedrock vs ChatBedrockConverse

| Aspect | `ChatAnthropicBedrock` | `ChatBedrockConverse` |
|---|---|---|
| API surface | Identical to `ChatAnthropic` | Bedrock Converse API |
| Package extras | Requires `langchain-aws[anthropic]` | Base install |
| Extended thinking | Via `thinking=` param | Via `additional_model_request_fields` |
| Best for | Claude-only workloads needing Anthropic API parity | Multi-model Bedrock deployments |

---

## ChatBedrock (Legacy)

```python
from langchain_aws import ChatBedrock

# Legacy — use only for custom/provisioned models not on Converse
llm = ChatBedrock(
    model_id="arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2",
    region_name="us-east-1",
    model_kwargs={"max_tokens": 1024},
)
```

---

## Amazon Nova Models

| Model | Inference profile ID |
|---|---|
| Nova Pro | `us.amazon.nova-pro-v1:0` |
| Nova Lite | `us.amazon.nova-lite-v1:0` |
| Nova Micro | `us.amazon.nova-micro-v1:0` |

Nova system tools: web grounding, code interpreter, browser toolkit (passed via `additional_model_request_fields`).

```python
from langchain_aws import ChatBedrockConverse

llm = ChatBedrockConverse(
    model_id="us.amazon.nova-pro-v1:0",
    region_name="us-east-1",
    max_tokens=2048,
)
response = llm.invoke("What is 15% of 847?")
print(response.text)
```

---

## Guardrails

```python
from langchain_aws import ChatBedrockConverse

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-west-2",
    max_tokens=1024,
    guardrails={
        "guardrailIdentifier": "abc123def456",
        "guardrailVersion": "1",
        "trace": "enabled",
    },
)

response = llm.invoke("Tell me about yourself.")
# Guardrail intervention appears in response_metadata
print(response.response_metadata.get("amazon-bedrock-guardrailAction"))
```

---

## Session Management (Bedrock Session Management Service)

For stateful/resumable agents, use the `langchain-checkpoint-aws` package which implements a
LangGraph checkpointer on top of **Bedrock Session Management Service + ElastiCache (Valkey)**:

```bash
uv add langchain-checkpoint-aws
```

This is infrastructure-level — requires ElastiCache/Valkey provisioning separate from
`langchain-aws` itself.

---

## Bedrock Embeddings

```python
from langchain_aws import BedrockEmbeddings

embeddings = BedrockEmbeddings(
    model_id="amazon.titan-embed-text-v2:0",
    region_name="us-west-2",
)

vectors = embeddings.embed_documents(["hello world", "foo bar"])
query_vec = embeddings.embed_query("what is this about?")
```

---

## tool_choice support matrix

| Model family | tool_choice options |
|---|---|
| Claude 3+ | auto, any, tool |
| Mistral Large (Bedrock) | auto, any |
| Amazon Nova | auto |

---

## Production gotchas summary

| Gotcha | Detail |
|---|---|
| Bare model ID → "on-demand throughput isn't supported" | Use cross-region inference profile IDs with `us.` / `eu.` / `apac.` prefix |
| ChatBedrock vs ChatBedrockConverse | Always use `ChatBedrockConverse` unless model requires legacy invoke |
| Fine-grained streaming partial JSON | Beta may emit invalid JSON chunks — buffer before parsing |
| ARN/custom models need `provider=` | Models with ARN or non-prefixed IDs need `provider="anthropic"` etc. |
| Session management separate package | Requires `langchain-checkpoint-aws` + ElastiCache/Valkey infrastructure |
| `AWS_BEARER_TOKEN_BEDROCK` priority | API key takes precedence over all AWS credential sources |

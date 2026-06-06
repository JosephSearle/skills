# Prompt Management Reference — LangSmith Versioned Prompts

## Concepts

A LangSmith prompt is a versioned `ChatPromptTemplate` (or `PromptTemplate`) stored with a
name, description, optional model/output-schema config, and metadata tags.

| Concept | Description |
|---|---|
| **Commit** | Immutable, SHA-identified snapshot — created every time a prompt is saved. Analogous to a Git commit. Pin a commit SHA in production for reproducibility. |
| **Tag** | Mutable label pointing to one commit at a time (e.g. `dev`, `staging`, `production`, `v2.1`). Hot-swappable without a code deploy. |
| **Environment tags** | Reserved tags `staging` and `production` support a controlled release flow — test in staging → promote to production → roll back by moving the tag. |
| **Prompt owner** | In "Owners only" mode, only designated owners may create/update commit tags, promote to environments, or delete the prompt. The creator is auto-added as owner. |
| **Namespace** | Workspace-level prompts (team) vs personal/user-level. Public Prompt Hub prompts are user-generated — review before production use. |

---

## pull_prompt

Network call — returns a Runnable (typically `ChatPromptTemplate`).

```python
from langsmith import Client

client = Client()

# Pull latest commit (do not use in production — non-deterministic)
prompt_latest = client.pull_prompt("joke-generator")

# Pull a pinned commit SHA (production-safe — immutable)
prompt_pinned = client.pull_prompt("joke-generator:a1b2c3d4e5f6")

# Pull the current 'production' environment tag (hot-swappable)
prompt_prod = client.pull_prompt("joke-generator:production")

# Pull from another workspace / user namespace
prompt_other = client.pull_prompt("owner-name/joke-generator:staging")
```

### pull_prompt() Signature

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `prompt_identifier` | `str` | required | `"name"`, `"name:tag"`, `"name:sha"`, or `"owner/name:tag"` |
| `include_model` | `bool` | `False` | Include model configuration in the returned Runnable |

The commit hash of a pulled prompt is available via `prompt.metadata["lc_hub_commit_hash"]`.

> **⚠️ SDK issue #1624:** `LANGSMITH_API_KEY` is not always auto-detected when calling
> `pull_prompt` in certain environments (e.g. when the env var is set after process start,
> or in some serverless runtimes). **Workaround:** always construct a `Client` instance
> explicitly and pass it, or call `pull_prompt` with `api_key` set on the Client:
>
> ```python
> import os
> from langsmith import Client
>
> client = Client(api_key=os.environ["LANGSMITH_API_KEY"])
> prompt = client.pull_prompt("my-prompt:production")
> ```

---

## Caching at Startup

`pull_prompt` is a network call. Do not call it per-request in production.

```python
# prompts.py — load once at application startup
from functools import lru_cache
import os
from langsmith import Client

_client = Client(api_key=os.environ["LANGSMITH_API_KEY"])
_prompt_cache: dict[str, object] = {}


def get_prompt(name: str, tag: str = "production") -> object:
    """Return cached prompt; call once per process start."""
    key = f"{name}:{tag}"
    if key not in _prompt_cache:
        _prompt_cache[key] = _client.pull_prompt(key)
    return _prompt_cache[key]


# At startup — pull all prompts used by this service
def warm_prompt_cache() -> None:
    get_prompt("checkout-agent-system", tag="production")
    get_prompt("checkout-agent-tools", tag="production")


# Re-pull on webhook trigger (see Prompt Webhooks section)
def refresh_prompt(name: str, tag: str = "production") -> None:
    key = f"{name}:{tag}"
    _prompt_cache[key] = _client.pull_prompt(key)
```

### Pinned SHA Pattern (Maximum Reproducibility)

```python
# Hard-pin a specific commit in production deployments
CHECKOUT_AGENT_PROMPT_SHA = "a1b2c3d4e5f67890abcdef1234567890abcdef12"

prompt = client.pull_prompt(f"checkout-agent-system:{CHECKOUT_AGENT_PROMPT_SHA}")
```

---

## push_prompt

```python
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate
from langsmith import Client

client = Client()

template = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        "You are a helpful checkout assistant. Today's date is {today}."
    ),
    ("human", "{user_message}"),
])

url = client.push_prompt(
    "checkout-agent-system",
    object=template,
    parent_commit_hash="latest",
    description="Checkout assistant system prompt v2.2",
    readme="See docs/prompts/checkout-agent.md",
    tags=["checkout", "assistant"],    # prompt-level metadata tags, not environment tags
    is_public=False,
)
print(f"Pushed to: {url}")
```

### push_prompt() Signature

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `prompt_identifier` | `str` | required | Prompt name (creates if not exists) |
| `object` | `ChatPromptTemplate \| None` | `None` | Template to push |
| `parent_commit_hash` | `str` | `"latest"` | SHA of the parent commit |
| `is_public` | `bool \| None` | `None` | Whether the prompt is publicly visible |
| `description` | `str \| None` | `None` | Human-readable description |
| `readme` | `str \| None` | `None` | Markdown readme for the prompt |
| `tags` | `list[str] \| None` | `None` | Prompt-level metadata tags (not commit/env tags) |

> **⚠️ commit_tags on push:** Newer SDK versions add a `commit_tags` parameter to tag the
> specific commit on push. Verify `commit_tags` support in your pinned SDK version — behaviour
> has changed across releases. If unsupported, use the `update_prompt` promotion workaround.

---

## hub.pull vs client.pull_prompt

| Dimension | `hub.pull("owner/name")` | `client.pull_prompt("name:commit")` |
|---|---|---|
| Package | `langchain-classic` (legacy) | `langsmith` (current) |
| Status | Deprecated — migrate | Recommended |
| Version pinning | Hash suffix supported | Commit SHA or env tag (`:production`) |
| Auth | Reads `LANGCHAIN_API_KEY` | Reads `LANGSMITH_API_KEY` (see issue #1624 workaround) |
| Returns | Runnable | Runnable (typically `ChatPromptTemplate`) |
| Production guidance | — | Pin SHA for reproducibility; tag for hot-swap deployments |

Migration:

```python
# Before (deprecated)
from langchain import hub
prompt = hub.pull("my-org/checkout-agent")

# After (current)
from langsmith import Client
client = Client(api_key=os.environ["LANGSMITH_API_KEY"])
prompt = client.pull_prompt("checkout-agent:production")
```

---

## Environment Tag Promotion

### staging → production Promotion via SDK

Historically there was no API to set environment/commit tags on push directly (GitHub issue
#2126). The established workaround: pull the staged commit, re-push its content to production,
and clear the old tag.

```python
from langsmith import Client
import os


def promote_staging_to_production(prompt_name: str) -> None:
    """Atomically promote the 'staging' tag to 'production'."""
    client = Client(api_key=os.environ["LANGSMITH_API_KEY"])

    # Pull the current staged version
    staging_prompt = client.pull_prompt(f"{prompt_name}:staging")
    staging_sha = staging_prompt.metadata["lc_hub_commit_hash"]

    # Pull current production version to check if promotion is needed
    try:
        prod_prompt = client.pull_prompt(f"{prompt_name}:production")
        prod_sha = prod_prompt.metadata["lc_hub_commit_hash"]
    except Exception:
        prod_sha = None

    if prod_sha == staging_sha:
        print(f"Staging and production are already at the same commit: {staging_sha}")
        return

    # Clear old production tag before re-pointing
    if prod_sha:
        client.update_prompt(f"{prompt_name}:{prod_sha}", tags=[])

    # Push the staging content with both tags
    client.push_prompt(
        prompt_name,
        object=staging_prompt,
        parent_commit_hash=staging_sha,
        tags=["staging", "production"],
    )
    print(f"Promoted {prompt_name}:{staging_sha} to production")
```

### Rollback

```python
def rollback_production(prompt_name: str, rollback_sha: str) -> None:
    """Roll back 'production' tag to a previous commit SHA."""
    client = Client(api_key=os.environ["LANGSMITH_API_KEY"])

    # Clear current production tag
    try:
        prod_prompt = client.pull_prompt(f"{prompt_name}:production")
        current_sha = prod_prompt.metadata["lc_hub_commit_hash"]
        client.update_prompt(f"{prompt_name}:{current_sha}", tags=[])
    except Exception:
        pass

    # Point production to the rollback commit
    rollback_prompt = client.pull_prompt(f"{prompt_name}:{rollback_sha}")
    client.push_prompt(
        prompt_name,
        object=rollback_prompt,
        parent_commit_hash=rollback_sha,
        tags=["production"],
    )
    print(f"Rolled back {prompt_name} to {rollback_sha}")
```

---

## Prompt Commit Webhooks

Configure a webhook in the LangSmith UI to fire on each commit to a prompt. Common uses:
- Trigger a CI/CD pipeline to run evals against the new prompt version before promoting
- Sync prompts to a GitHub repository
- Invalidate the in-process prompt cache (call `refresh_prompt()`)

### Webhook Payload Format

```json
{
  "event": "prompt.commit",
  "prompt_name": "checkout-agent-system",
  "commit_hash": "a1b2c3d4e5f67890abcdef1234567890abcdef12",
  "commit_tags": ["staging"],
  "workspace_id": "ws_abc123",
  "timestamp": "2026-06-06T12:00:00Z"
}
```

### FastAPI Webhook Handler (Example)

```python
import hashlib
import hmac
import os
from fastapi import FastAPI, HTTPException, Request

app = FastAPI()

WEBHOOK_SECRET = os.environ["LANGSMITH_WEBHOOK_SECRET"]


@app.post("/langsmith-webhook")
async def handle_prompt_commit(request: Request) -> dict:
    body = await request.body()

    # Verify HMAC signature
    signature = request.headers.get("X-LangSmith-Signature", "")
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    prompt_name = payload["prompt_name"]
    commit_hash = payload["commit_hash"]
    tags = payload.get("commit_tags", [])

    if "staging" in tags:
        # Re-pull the updated prompt into the cache
        refresh_prompt(prompt_name, tag="staging")
        # Optionally: trigger CI eval pipeline
        await trigger_eval_pipeline(prompt_name, commit_hash)

    return {"status": "ok"}
```

---

## Programmatic CI/CD Pipeline

Combine pull_prompt + evaluate + promote in one CI script:

```python
#!/usr/bin/env python3
"""
Prompt promotion pipeline: test staging → promote to production if evals pass.
"""
import os
import sys
from statistics import mean

from langsmith import Client, evaluate
from openevals.llm import create_llm_as_judge
from openevals.prompts import CORRECTNESS_PROMPT

PROMPT_NAME = "checkout-agent-system"
EVAL_DATASET = "checkout-agent-suite"
THRESHOLD = 0.85

client = Client(api_key=os.environ["LANGSMITH_API_KEY"])

# Pull staging prompt
staging_prompt = client.pull_prompt(f"{PROMPT_NAME}:staging")
staging_sha = staging_prompt.metadata["lc_hub_commit_hash"]
print(f"Evaluating staging commit: {staging_sha}")

# Build a target that uses this exact prompt version
correctness = create_llm_as_judge(
    prompt=CORRECTNESS_PROMPT,
    feedback_key="correctness",
    model="openai:gpt-4o-mini",
)


def target(inputs: dict) -> dict:
    chain = staging_prompt | model | parser
    return {"answer": chain.invoke(inputs)}


results = evaluate(
    target,
    data=EVAL_DATASET,
    evaluators=[correctness],
    experiment_prefix=f"staging-{staging_sha[:8]}",
    max_concurrency=8,
    metadata={"prompt_sha": staging_sha, "prompt_tag": "staging"},
)

feedback_items = list(
    client.list_feedback(
        run_ids=[row["run"].id for row in results],
        feedback_key="correctness",
    )
)
scores = [f.score for f in feedback_items if f.score is not None]
mean_score = mean(scores) if scores else 0.0

print(f"Staging eval mean correctness: {mean_score:.3f} (threshold: {THRESHOLD})")

if mean_score < THRESHOLD:
    print("Staging eval FAILED — not promoting to production.")
    sys.exit(1)

# Promote staging → production
promote_staging_to_production(PROMPT_NAME)
print(f"Promoted {PROMPT_NAME}:{staging_sha[:8]} to production")
```

---

## Production Gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| SDK issue #1624: `LANGSMITH_API_KEY` not auto-detected in `pull_prompt` | `401 Unauthorized` or `AuthError` even though env var is set | Construct `Client(api_key=os.environ["LANGSMITH_API_KEY"])` explicitly |
| Using `:latest` tag in production | Different prompt loaded on each process restart | Pin the commit SHA (`name:a1b2c3d4`) — commits are immutable |
| Pulling per-request | High latency and API rate limits | Pull once at startup into `_prompt_cache`; re-pull on webhook |
| `hub.pull` in new code | Uses deprecated `langchain-classic` | Migrate to `client.pull_prompt("name:tag")` |
| `commit_tags` on push not available | `TypeError: push_prompt() got an unexpected keyword argument 'commit_tags'` | Verify SDK version; use `update_prompt` workaround for older versions |
| Self-removing as owner | Loses management rights permanently (until another owner restores) | In "Owners only" mode, always add a second owner before any changes |
| Mutable tag race condition in multi-deployer teams | Two deploys simultaneously move the `production` tag | Use immutable commit SHAs for production; treat tags as convenience aliases only |
| Prompt Hub public prompts | Unverified community content in production | Review source; prefer workspace-scoped prompts for production systems |

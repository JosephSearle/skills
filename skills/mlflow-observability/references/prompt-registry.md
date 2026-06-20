# MLflow Prompt Registry Reference

## Register a prompt

```python
import mlflow

# Each call creates an immutable new version (version numbers increment automatically)
mlflow.genai.register_prompt(
    name="agent-system-prompt",
    template="You are a helpful assistant. Context: {{context}}. Question: {{question}}",
    commit_message="Add context variable for RAG pipeline",
)
# → version 1 created
```

Template variables use `{{double-brace}}` syntax. Versions are immutable — always register
a new version to change a prompt.

## Load a prompt

```python
# By version number
prompt = mlflow.genai.load_prompt("prompts:/agent-system-prompt/1")

# By alias (recommended for production code)
prompt = mlflow.genai.load_prompt("prompts:/agent-system-prompt@production")

# Access template string
print(prompt.template)
# "You are a helpful assistant. Context: {{context}}. Question: {{question}}"

# Convert to LangChain-compatible single-brace format
lc_template = prompt.to_single_brace_format()
# "You are a helpful assistant. Context: {context}. Question: {question}"
```

Always load by **alias** in production code. This decouples the agent from specific version
numbers — you can promote a new version without redeploying the agent.

## Manage aliases

```python
client = mlflow.MlflowClient()

# Set alias to point to a version
client.set_registered_model_alias("agent-system-prompt", "production", version=1)
client.set_registered_model_alias("agent-system-prompt", "staging", version=2)

# Delete alias
client.delete_registered_model_alias("agent-system-prompt", "staging")

# Convenience wrapper (3.14.0+)
mlflow.genai.set_prompt_alias("agent-system-prompt", alias="production", version=3)
```

Standard aliases:
- `production` → current live version
- `staging` → candidate for promotion
- `dev` → work-in-progress

## Promotion workflow

```
dev (v1) → staging (v2, tested) → production (v3, deployed)
```

```python
# Promote staging to production
client.set_registered_model_alias("agent-system-prompt", "production", version=2)
# Old production version still exists — roll back by re-aliasing
```

## Use in a LangChain chain

```python
import mlflow
from langchain_core.prompts import PromptTemplate
from langchain.chat_models import init_chat_model

prompt_obj = mlflow.genai.load_prompt("prompts:/agent-system-prompt@production")
lc_prompt = PromptTemplate.from_template(prompt_obj.to_single_brace_format())

model = init_chat_model("anthropic:claude-sonnet-4-6")
chain = lc_prompt | model
```

## List and search prompts

```python
client = mlflow.MlflowClient()

# List all registered prompts
for prompt in client.search_registered_models(filter_string="tags.type = 'prompt'"):
    print(prompt.name, prompt.latest_versions)

# Get specific version metadata
version = client.get_prompt_version("agent-system-prompt", version=1)
print(version.commit_message, version.creation_timestamp)
```

## Gotchas

- `{{double-brace}}` in MLflow ↔ `{single-brace}` in LangChain — always call `to_single_brace_format()`.
- Versions are immutable — there is no edit; register a new version.
- Prompt Registry uses the MLflow Model Registry under the hood — prompts appear alongside models in the UI.
- Set `mlflow.set_tracking_uri()` before any prompt registry calls.

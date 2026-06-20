# langgraph.json Reference

## Full schema

```json
{
  "graphs": {
    "<assistant-name>": "<module-path>:<attribute>"
  },
  "dependencies": [".", "path/to/other-package"],
  "env": ".env",
  "python_version": "3.11",
  "pip_config_file": "pip.conf",
  "auth": {
    "path": "./src/myagent/auth.py:auth_handler"
  },
  "http": {
    "app": "./src/myagent/http_middleware.py:app_middleware"
  },
  "store": {
    "index": {
      "embed": "./src/myagent/embeddings.py:embed_fn",
      "dims": 1536,
      "fields": ["$"]
    }
  }
}
```

## `graphs` — required

Maps assistant names to `CompiledGraph` objects. The format is `"<relative-path>:<attribute>"`:

```json
{
  "graphs": {
    "customer_support": "./src/myagent/graph.py:compiled_graph",
    "researcher":       "./src/agents/researcher.py:researcher_graph"
  }
}
```

Multiple graphs in one server = multiple assistants. Clients select by `assistant_id`.

## `dependencies` — required

Python packages to install in the server image. Use `"."` for the project root.
For monorepos with multiple packages:

```json
{
  "dependencies": [".", "./packages/core", "./packages/tools"]
}
```

## `env` — environment variable loading

Points to a `.env` file relative to `langgraph.json`. Required env vars at runtime:

```bash
# Required
POSTGRES_URI=postgresql://user:pass@host:5432/langgraph
REDIS_URI=redis://host:6379

# LLM provider keys (whichever you use)
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...

# MLflow tracing (optional — see observability skill)
MLFLOW_TRACKING_URI=http://mlflow:5000
```

## `auth` — custom authentication

Point to a callable that implements the auth handler:

```python
# src/myagent/auth.py
from langgraph_sdk import Auth

auth = Auth()

@auth.authenticate
async def authenticate(headers: dict) -> str:
    token = headers.get("x-api-key", "")
    if token != EXPECTED_TOKEN:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")
    return "user-id"

@auth.on.threads.create
async def on_thread_create(ctx, value):
    # Namespace threads per user
    value["metadata"]["owner"] = ctx.user_id
    return value
```

## `store` — semantic search index (optional)

Enables semantic search across the LangGraph `BaseStore` managed by the server:

```json
{
  "store": {
    "index": {
      "embed": "./src/myagent/embeddings.py:embed_texts",
      "dims": 1536,
      "fields": ["$"]
    }
  }
}
```

The `embed` function signature: `async def embed_texts(texts: list[str]) -> list[list[float]]`.

## `langgraph dev` — local development

```bash
langgraph dev                      # default port 2024
langgraph dev --port 8080          # custom port
langgraph dev --no-browser         # skip opening browser
langgraph dev --allow-blocking     # permit synchronous code (not recommended)
```

Hot-reload: edits to graph files restart the server automatically. Does not require Postgres or
Redis — uses in-memory alternatives for local dev only.

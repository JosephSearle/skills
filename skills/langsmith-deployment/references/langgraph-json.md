# langgraph.json Reference

## Schema Overview

`langgraph.json` is the central configuration file consumed by every `langgraph` CLI command:
`dev`, `build`, `up`, `deploy`, and `dockerfile`. It is validated by `validate_config_file()`
/ `validate_config()` in `langgraph_cli/config.py`. Place it at the root of your project.

```json
{
  "$schema": "https://langgra.ph/schema.json"
}
```

---

## Complete Field Reference

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `dependencies` | `string[]` | Yes | — | Pip packages and/or local paths. `"."` = project root; `"./sub"` = local subdirectory; `"langchain_openai"` = PyPI. Entries starting with `.` trigger local dependency scan. |
| `graphs` | `object` | Yes | — | Map of `graph_id → import_path`. Format: `"./path/file.py:variable"`. Each graph ID becomes a default Assistant on deploy. |
| `env` | `string \| string[]` | No | — | Path to a `.env` file (string) OR a list of env var names to pass from host. |
| `python_version` | `"3.11" \| "3.12"` | No | `"3.11"` | Python version used inside the built image. |
| `dockerfile_lines` | `string[]` | No | `[]` | Raw Dockerfile instructions injected immediately after the base image `FROM` statement. Use for system packages, certificates, etc. |
| `pip_config_file` | `string` | No | — | Path to a `pip.conf` for private package registries. |
| `image_distro` | `string` | No | `"debian"` | Base image OS variant. Options: `debian`, `wolfi`, `bookworm`, `bullseye`. Requires `langgraph-cli ≥ 0.2.11`. |
| `store` | `object` | No | — | Long-term memory Store configuration. Contains `index` (embed model, dims, fields) and optional TTL config. |
| `http` | `object` | No | — | HTTP server overrides: `disable_mcp`, `disable_webhooks`, `auth`, `checkpointer`, `encryption` blocks. |
| `api_version` | `string` | No | — | Pins the `langgraph-api` server package version (e.g., `"0.5.35"`) independently of the base image tag. |

> **⚠️ langgraph-cli ≥ 0.2.11:** The `image_distro` field was added in this version. Use `"wolfi"` for smaller, more secure images (recommended). On older CLI versions the field is silently ignored.

---

## `dependencies` — Reserved Local Directory Names

Local path entries (starting with `.`) must not use any of the following directory names, as
they are reserved by the Agent Server runtime and will cause silent collisions:

| Reserved name | Reason |
|---|---|
| `src` | Standard Python src layout |
| `langgraph-api` / `langgraph_api` | Server runtime package |
| `langgraph` | Core library |
| `langchain-core` / `langchain_core` | LangChain core |
| `pydantic` | Data validation |
| `orjson` | Fast JSON serialisation |
| `fastapi` | ASGI framework |
| `uvicorn` | ASGI server |
| `psycopg` | Postgres driver |
| `httpx` | HTTP client |
| `langsmith` | Tracing library |

Paths outside the config file's directory become Docker `--build-context` flags automatically.

---

## `graphs` — Import Path Format

```
"graph_id": "./relative/path/to/file.py:attribute_name"
```

The `<file_path>:<attribute>` format lets the server import a compiled `StateGraph` instance
or an `@entrypoint`-decorated function. The CLI rewrites these paths (along with `auth.path`,
`http.app`, `encryption.path`, `checkpointer.path`) to in-container absolute paths during
build. The resulting in-container mapping is stored in the `LANGSERVE_GRAPHS` environment
variable.

---

## `image_distro` — Distro Options

| Distro | Base OS | Size | Security | Recommendation |
|---|---|---|---|---|
| `wolfi` | Wolfi (Chainguard) | Smallest | Best — minimal attack surface | **Recommended for production** |
| `debian` | Debian stable | Medium | Standard | Default if field omitted |
| `bookworm` | Debian 12 | Medium | Standard | Explicit Debian 12 pin |
| `bullseye` | Debian 11 | Medium | Standard | Legacy; avoid for new projects |

---

## `store` — Semantic Search Configuration

```json
{
  "store": {
    "index": {
      "embed": "openai:text-embedding-3-small",
      "dims": 1536,
      "fields": ["$"]
    },
    "ttl": {
      "default_ttl": 60,
      "refresh_on_read": true
    }
  }
}
```

| Sub-field | Type | Description |
|---|---|---|
| `index.embed` | `string` | Embedding model. Format: `"provider:model-name"`. |
| `index.dims` | `integer` | Embedding dimensions. Must match the model output. |
| `index.fields` | `string[]` | JSON paths of Store item value fields to embed. `"$"` = entire value. |
| `ttl.default_ttl` | `number` | Default TTL for store items (units: verify against your version — docs say minutes; SDK docstring says seconds). |
| `ttl.refresh_on_read` | `boolean` | Reset TTL on each read access. |

> **⚠️ TTL unit conflict:** The REST API documentation states `ttl` is in **minutes**; the
> SDK `put_item` docstring says **seconds**. Test against your installed version before relying
> on expiration timing in production.

---

## `http` — Server Behaviour Overrides

```json
{
  "http": {
    "disable_mcp": false,
    "disable_webhooks": false,
    "auth": {
      "path": "./auth.py:auth_handler"
    },
    "checkpointer": {
      "path": "./checkpointer.py:get_checkpointer"
    },
    "encryption": {
      "path": "./encryption.py:encryption_config"
    }
  }
}
```

- `disable_mcp: true` — disables the `/mcp` endpoint (requires `langgraph-api ≥ 0.2.3`)
- `disable_webhooks: true` — disables webhook delivery (requires `langgraph-api ≥ 0.2.78`)

---

## Single-Graph Example

```json
{
  "$schema": "https://langgra.ph/schema.json",
  "dependencies": ["langchain_openai", "./your_package"],
  "graphs": {
    "agent": "./your_package/agent.py:graph"
  },
  "env": "./.env",
  "python_version": "3.11",
  "image_distro": "wolfi",
  "dockerfile_lines": [
    "RUN apt-get update && apt-get install -y ffmpeg"
  ]
}
```

## Multi-Graph Example

```json
{
  "$schema": "https://langgra.ph/schema.json",
  "dependencies": ["."],
  "graphs": {
    "chatbot": "./chatbot.py:graph",
    "financial_advisor": "./financial_advisor.py:graph",
    "map_reduce": "./map_reduce.py:graph"
  },
  "env": "./.env",
  "python_version": "3.12",
  "image_distro": "wolfi",
  "store": {
    "index": {
      "embed": "openai:text-embedding-3-small",
      "dims": 1536,
      "fields": ["$"]
    }
  }
}
```

Each key in `graphs` becomes an independent default Assistant (accessible by graph ID) on
deployment. All graphs share the same Postgres and Redis backends.

---

## CLI Commands

### `langgraph dev`

Local in-memory development server. No Docker required. Hot-reload on file changes. Opens
LangGraph Studio automatically.

| Flag | Type | Default | Description |
|---|---|---|---|
| `--host` | `string` | `127.0.0.1` | Bind address |
| `--port` | `integer` | `2024` | Bind port |
| `--no-reload` | flag | off | Disable hot reload |
| `--debug-port` | `integer` | — | Enable remote debugging via debugpy on this port |
| `--no-browser` | flag | off | Do not open Studio in browser |
| `-c / --config` | `path` | `langgraph.json` | Path to config file |
| `--n-jobs-per-worker` | `integer` | `10` | Max concurrent runs per worker |

```bash
langgraph dev --port 2024 --no-browser
langgraph dev --debug-port 5678 --n-jobs-per-worker 5
```

State is persisted to a local directory during `dev`. Requires `LANGSMITH_API_KEY` with
LangSmith access (for Studio connectivity). The in-memory variant requires
`langgraph-cli[inmem]`.

### `langgraph build`

Builds a Docker image from `langgraph.json`. Translates the config into a Dockerfile and pipes
it to `docker build -f -`.

| Flag | Type | Default | Description |
|---|---|---|---|
| `-t` | `string` | required | Image tag (e.g., `my-org/my-agent:latest`) |
| `--platform` | `string` | — | Target platform(s), e.g., `linux/amd64,linux/arm64` |
| `--pull / --no-pull` | flag | `--pull` | Whether to pull the base image |
| `-c / --config` | `path` | `langgraph.json` | Path to config file |

```bash
langgraph build -t my-org/my-agent:1.2.3 --platform linux/amd64
langgraph build -t my-org/my-agent:dev --no-pull
```

The build removes pip/setuptools/wheel from the final image by default (override with
`keep_pkg_tools` if you need them at runtime).

### `langgraph up`

Runs the full production-like Docker Compose stack locally: Agent Server + Postgres with
pgvector + Redis. Validates the full infrastructure stack before shipping to production.

| Flag | Type | Default | Description |
|---|---|---|---|
| `-p / --port` | `integer` | `8123` | Host port the Agent Server binds to |
| `--wait` | flag | off | Block until all services are healthy |
| `--watch` | flag | off | Restart Agent Server on local file changes |
| `--verbose` | flag | off | Print all Docker Compose output |
| `-c / --config` | `path` | `langgraph.json` | Path to config file |
| `-d / --docker-compose` | `path` | — | Additional Docker Compose file (for extra services) |
| `--engine-runtime-mode` | `string` | `combined_queue_worker` | `combined_queue_worker` or `distributed` (separate executor/orchestrator via Kafka) |

```bash
# Wait for healthy, then run tests
langgraph up --wait --port 8123

# Watch mode for iterative dev (requires built image)
langgraph build -t my-agent:dev && langgraph up --watch

# Distributed mode (Kafka-based; for advanced multi-node setups)
langgraph up --engine-runtime-mode distributed
```

Sets up the `langgraph-data` persistent volume. Can inject `langgraph-debugger` for local
inspection. Health checks: Postgres `pg_isready`, Redis `redis-cli ping`.

### `langgraph deploy`

**NEW command added at the October 23, 2025 rebrand.** Not a rename of any existing command.
Builds the image and provisions or updates a deployment on LangSmith Cloud (Postgres + Redis
provisioned automatically). Can create new deployments or update deployments originally created
via the UI or GitHub integration.

```bash
LANGSMITH_API_KEY=lsv2_... langgraph deploy
langgraph deploy --config path/to/langgraph.json
```

Authentication is via `LANGSMITH_API_KEY`. Requires Plus plan or above on the LangSmith
workspace.

### `langgraph dockerfile`

Generates a Dockerfile from `langgraph.json` and writes it to a file. Use when you need to
customise the Docker build beyond what `dockerfile_lines` supports.

```bash
langgraph dockerfile Dockerfile.generated
langgraph dockerfile Dockerfile.generated -c path/to/langgraph.json
```

> **Critical:** You must **re-run `langgraph dockerfile`** after every edit to `langgraph.json`.
> The generated Dockerfile is a snapshot — it does not auto-update.

### Additional CLI commands

| Command | Description |
|---|---|
| `langgraph logs` | Stream runtime logs (`deploy`) or remote build logs (`build`) for a Cloud deployment |
| `langgraph new` | Scaffold a new project from a template (e.g., `deep agent`, `simple agent`) |

---

## Build Internals

- The CLI reads `langgraph.json` and generates a Dockerfile in memory
- Local `.` path entries are scanned for packages; paths outside the config dir become
  `--build-context` flags passed to `docker build`
- The generated `LANGSERVE_GRAPHS` env var holds the in-container path mapping for all graphs
- Compiled graph export (returning a `CompiledGraph` from an `@entrypoint` function or module
  attribute) is recommended: loaded once at server startup, no per-request recompilation

---

## Production Gotchas

| Failure mode | Root cause | Remedy |
|---|---|---|
| Import error on server start | Graph attribute not exported at module level | Ensure `graph = builder.compile()` is at module scope, not inside a function |
| Reserved dir name collision | Local dep dir named `src`, `langgraph`, etc. | Rename the local directory to avoid reserved names (see table above) |
| `dockerfile_lines` system packages missing in prod | APT not available in wolfi images | Use `wolfi` apk packages, or switch to `debian` distro for APT-based installs |
| `api_version` pin causes build failure | Pinned version incompatible with CLI version | Remove pin or align to a compatible `langgraph-api` release |
| Stale generated Dockerfile after config change | `langgraph dockerfile` output is a static snapshot | Always re-run `langgraph dockerfile` after editing `langgraph.json` |
| `image_distro` field unrecognised | `langgraph-cli` version below 0.2.11 | Upgrade CLI: `uv add --dev langgraph-cli` |
| Multi-graph deployment: wrong assistant activated | Graph IDs in `graphs` must be stable across deploys | Treat graph IDs as stable API identifiers; avoid renaming them |

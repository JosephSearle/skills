# Large Results & Eviction Reference — deepagents FilesystemMiddleware

> Two separate thresholds govern when tool results are offloaded to the filesystem backend.

---

## The two eviction thresholds

| Constant | Default | Governs |
|---|---|---|
| `tool_token_limit_before_evict` | **20 000 tokens** (~80 KB chars) | Per-tool-result size before it is evicted from state and saved to `/large_tool_results/` |
| `TOOL_RESULT_TOKEN_LIMIT` | **~100 000 tokens** | Immediate inline offload for a single very large tool call |

When a result exceeds `tool_token_limit_before_evict`, the harness:
1. Saves the full result to `/large_tool_results/<uuid>` on the backend.
2. Replaces the tool result in the model context with a reference string pointing to that path.
3. The model can then call `read_file("/large_tool_results/<uuid>")` to retrieve it in chunks.

---

## Customising the threshold

`tool_token_limit_before_evict` is **not directly configurable via `create_deep_agent`**. The middleware is instantiated internally three times (main agent, general-purpose subagent, user subagents). Workarounds:

1. **Drop to `create_agent`** and pass a configured `FilesystemMiddleware` manually:

```python
from langchain.agents import create_agent
from deepagents.middleware import FilesystemMiddleware
from deepagents.backends import StateBackend

backend = StateBackend()
agent = create_agent(
    model="anthropic:claude-sonnet-4-6",
    middleware=[
        FilesystemMiddleware(backend=backend, tool_token_limit_before_evict=50_000),
    ],
)
```

2. **Monkey-patch** after `create_deep_agent` returns (fragile; breaks on internal refactors).

3. **Wait for issue #2784** — the team is tracking a `tool_token_limit_before_evict` param on `create_deep_agent`.

---

## Backend requirements for eviction

Evicted results are written to the backend. If the backend is in-memory only (e.g. default `StateBackend` without persistence), evicted results survive only for the current process lifetime. For production:

- Use `FilesystemBackend(root_dir="/persistent/path")` for disk persistence.
- Use a sandbox backend (`ModalSandbox`, etc.) for remote persistence.
- Use `CompositeBackend` to route `/large_tool_results/` to a durable backend.

---

## Multimodal file reads

Since deepagents v0.5, `read_file` returns multimodal content blocks for binary files.

### Supported file types (extension-detected)

| Type | Extensions |
|---|---|
| Image | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |
| Audio | `.mp3`, `.wav`, `.ogg` |
| Video | `.mp4`, `.webm` |
| PDF | `.pdf` |

Files with unrecognised extensions are returned as text.

### Model compatibility

| File type | Model requirement |
|---|---|
| Image | Any multimodal model (Claude Sonnet/Opus/Haiku, GPT-4o, Gemini) |
| PDF | Claude (natively); GPT-4o via vision fallback |
| Audio | Claude Sonnet 4.x+; verify per model docs |
| Video | Limited — verify per model docs before using in production |

**Always confirm the model supports the file type before reading binary files.** The harness returns the content block; if the model doesn't support it, the API call will error.

### Multimodal read example

```python
result = agent.invoke(
    {"messages": [{"role": "user", "content": "Read /uploads/diagram.png and describe it."}]},
    config={"configurable": {"thread_id": "img-session-1"}},
)
# The agent calls read_file("/uploads/diagram.png")
# FilesystemMiddleware returns an image content block
# The model sees the image and can describe/analyse it
```

---

## `/large_tool_results/` and `/conversation_history/` paths

The harness auto-writes to these paths. Do not:
- Deny access to them via `FilesystemPermission`
- Write your application data here (name collisions)
- Expose them to untrusted callers

These paths live under whatever `root_dir` the backend is configured with, or in the state store for `StateBackend`.

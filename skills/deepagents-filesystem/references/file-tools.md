# File Tools Reference — deepagents FilesystemMiddleware

> All tools below are added by `FilesystemMiddleware` and are visible to the model.
> `execute` is conditionally added — see the execute section.

---

## Tool availability summary

| Tool | Always present? | Condition |
|---|---|---|
| `ls` | Yes | — |
| `read_file` | Yes | — |
| `write_file` | Yes | — |
| `edit_file` | Yes | — |
| `glob` | Yes | — |
| `grep` | Yes | — |
| `execute` | No | Only when backend implements `SandboxBackendProtocol` |

---

## ls

List directory contents.

```
ls(path: str) -> str
```

- Maps to `read` operation for permission checking.
- Returns filenames separated by newlines.
- On an empty directory returns an empty string.

---

## read_file

Read a file. Returns text or multimodal content blocks (v0.5+).

```
read_file(path: str) -> str | list[ContentBlock]
```

- Maps to `read` operation.
- For text files: returns raw text content.
- For binary files (image, audio, video, PDF): returns multimodal content blocks auto-detected from the file extension.
- **Multimodal support depends on the model** — pass only to a multimodal-capable model; audio/video support varies.
- Supported binary types (v0.5+): images (png, jpg, gif, webp), audio (mp3, wav, ogg), video (mp4, webm), PDF.

---

## write_file

Write (create or overwrite) a file.

```
write_file(path: str, content: str) -> str
```

- Maps to `write` operation.
- Creates parent directories if they do not exist.
- Overwrites existing files without warning.
- Returns a confirmation string on success.

---

## edit_file

Replace a specific string in an existing file.

```
edit_file(path: str, old_string: str, new_string: str) -> str
```

- Maps to `write` operation.
- **Requires the agent to call `read_file` on the same path first** — the tool errors if it hasn't seen the current file content.
- `old_string` must match exactly (whitespace, indentation, line endings).
- Do not include line-number prefixes in `old_string` or `new_string`.
- `old_string` must be unique in the file; provide more surrounding context to disambiguate if needed.
- Returns a diff-style confirmation on success.

### edit_file common errors

| Error | Cause | Fix |
|---|---|---|
| "File not read" | `read_file` not called before `edit_file` | Call `read_file` first in the same session |
| "String not found" | `old_string` doesn't match file exactly | Re-read the file; copy `old_string` verbatim |
| "Multiple matches" | `old_string` appears more than once | Expand `old_string` to include more surrounding context |

---

## glob

Find files matching a glob pattern.

```
glob(pattern: str, path: str | None = None) -> str
```

- Maps to `read` operation.
- `pattern`: glob expression (e.g. `**/*.py`, `src/**/*.ts`).
- `path`: optional base directory; defaults to filesystem root.
- Returns newline-separated matching paths.

---

## grep

Search file contents for a literal string.

```
grep(pattern: str, path: str | None = None, include: str | None = None) -> str
```

- Maps to `read` operation.
- `pattern`: **literal string** (not a regex).
- `path`: directory to search (recursive); defaults to filesystem root.
- `include`: glob filter on filenames (e.g. `*.py`).
- Returns matching lines with file and line number.
- Uses ripgrep internally when available; falls back to a slower Python path. Since v0.6.5 the fallback is logged.

---

## execute

Run a shell command inside the sandbox.

```
execute(command: str) -> str
```

- **Only added when the backend implements `SandboxBackendProtocol`.**
- `StateBackend` and `FilesystemBackend` do NOT implement `SandboxBackendProtocol` — no `execute` tool.
- Returns combined stdout + stderr, exit code, and a truncation notice if output is large.
- Large `execute` output is auto-saved to a file for incremental `read_file`; the tool result contains the file path reference.
- To provide `execute`: use `ModalSandbox`, `DaytonaSandbox`, `RunloopSandbox`, `AgentCoreSandbox`, or `LangSmithSandbox` as the backend (see `deepagents-sandbox` skill).

### How to disable execute on a sandbox backend

Use `excluded_tools` in a HarnessProfile:

```python
from deepagents import HarnessProfile, register_harness_profile

register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(excluded_tools=frozenset({"execute"})),
)
```

Or pass `excluded_tools` directly to `create_deep_agent` via the profile mechanism — do not remove `FilesystemMiddleware` itself.

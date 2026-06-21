# QuickJS Interpreter Reference — CodeInterpreterMiddleware

> Shipped in deepagents-code 0.1.4 (May 21 2026). Separate from the dcode CLI.

---

## Install

```bash
# Python
uv add langchain-quickjs

# JavaScript / TypeScript
npm add @langchain/quickjs
```

---

## What it does

`CodeInterpreterMiddleware` adds an `eval` tool that runs JavaScript code in a QuickJS sandbox. The agent can use `eval` to perform computations, data transformations, and logic that benefits from a deterministic interpreter rather than LLM token generation.

---

## Python usage

```python
from langchain_quickjs import CodeInterpreterMiddleware
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    middleware=[
        CodeInterpreterMiddleware(
            ptc=["read_file", "glob"],   # programmatic tool calling allowlist
        )
    ],
)
```

## JavaScript / TypeScript usage

```typescript
import { createCodeInterpreterMiddleware } from "@langchain/quickjs";
import { createDeepAgent } from "deepagents";

const agent = createDeepAgent({
  model: "anthropic:claude-sonnet-4-6",
  middleware: [
    createCodeInterpreterMiddleware({
      ptc: ["read_file", "glob"],
    }),
  ],
});
```

---

## Default isolation model

By default, QuickJS code has **no access** to:

| Resource | Access |
|---|---|
| Host filesystem | No |
| Network | No |
| Shell | No |
| Package manager (npm, pip) | No |
| System clock | No |
| Host environment variables | No |

QuickJS runs the JavaScript in a fully isolated interpreter with no I/O capabilities unless explicitly bridged via PTC.

---

## Programmatic Tool Calling (PTC)

`ptc=[...]` is an allowlist of deepagents tool names that the QuickJS runtime can call from inside the `eval` tool:

```python
CodeInterpreterMiddleware(
    ptc=["read_file", "glob", "grep"],
)
```

Inside the `eval` tool, the agent can then call those tools programmatically:

```javascript
// Inside eval — calls read_file via PTC
const content = await tools.read_file("/data/report.txt");
const lines = content.split("\n").filter(l => l.includes("ERROR"));
return lines.length;
```

### PTC allowlist rules

- Only tools explicitly listed in `ptc=` can be called from within QuickJS.
- Tools not in the allowlist are not callable from within `eval`.
- Subagent dispatch (`task` tool) is on by default and can be used from within QuickJS to delegate to subagents.

---

## CRITICAL: PTC bypasses interrupt_on

**PTC-invoked tool calls bypass `interrupt_on` approval workflows.**

```python
agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    middleware=[CodeInterpreterMiddleware(ptc=["write_file"])],
    interrupt_on={"write_file": True},   # ← this is NOT enforced for PTC calls
)
```

If `write_file` is in the `ptc=` allowlist, the agent can call `write_file` from inside `eval` without triggering the `interrupt_on` pause.

**Mitigation:**
- Do not put sensitive tools (write_file, execute, etc.) in the `ptc=` allowlist if HITL is required for those tools.
- Treat QuickJS + PTC as a scoped runtime where the agent has elevated tool access, not as a security boundary.
- Audit the `ptc=` list carefully — each entry is a potential HITL bypass.

---

## QuickJS as a scoped runtime, not a sandbox

QuickJS provides **interpreter isolation** (no host I/O by default) but:
- PTC bridges can grant arbitrary host access.
- The interpreter itself runs in the same process as the agent — it is not a container or VM.
- Do not rely on QuickJS for security-critical isolation — use a real sandbox provider (Modal, Daytona, etc.) for that.

---

## Use cases for CodeInterpreterMiddleware

| Use case | Why QuickJS over shell execute |
|---|---|
| Arithmetic / financial calculations | Deterministic float arithmetic; no shell dependency |
| JSON/CSV data transformation | Built-in JS data manipulation; fast, no subprocess |
| Template rendering | String interpolation in JS without shell injection risk |
| Algorithmic logic | Runs in-process; faster than spinning up a subprocess |
| Light data validation | Schema checks, format validation — no external libs needed |

For heavy computation, package installation, or system interaction — use `execute` with a real sandbox backend.

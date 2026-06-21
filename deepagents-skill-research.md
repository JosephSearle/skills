# DeepAgents Skill Gap Analysis & New Skill Proposals

## TL;DR
- The existing `deepagents.md` reference (current to v0.6.7) is broad but shallow on six high-value subsystems; the library has since shipped to **v0.6.10** (confirmed on PyPI) with new surfaces — **RubricMiddleware** (added in deepagents 0.6.5), the **QuickJS interpreter middleware** (added in deepagents-code 0.1.4), and the **LangSmith sandbox** beta — that are entirely uncovered.
- I recommend **six new dedicated skills**: `deepagents-filesystem`, `deepagents-harness-and-claude`, `deepagents-sandbox`, `deepagents-subagents-and-async`, `deepagents-skills-and-memory`, and `deepagents-codegen-dcode`, plus an optional seventh (`deepagents-rubric-and-eval`).
- Every proposal is grounded in official LangChain docs and the official GitHub repo/reference (trust 9–10/10); third-party blogs are used only for corroboration and flagged as 4–6/10.

## Key Findings

### What the existing skill already covers well
The current `deepagents.md` covers `create_deep_agent`, the SubAgent TypedDict family (SubAgent, CompiledSubAgent, AsyncSubAgent), the full middleware stack, all backends, HarnessProfile, DeltaChannel, the dcode CLI, production gotchas, and a stability matrix. That is a strong "single-file" reference. The gap is **depth**: each of those subsystems now has its own dedicated official documentation page with non-trivial APIs, security models, and gotchas that a one-file reference cannot hold. The remedy is to split depth out into focused skills and keep `deepagents.md` as the index/router.

### Version drift (act on this first)
- PyPI's current release is **deepagents 0.6.10** (confirmed: "Details for the file deepagents-0.6.10.tar.gz" on pypi.org/project/deepagents); the existing skill stops at 0.6.7.
- **RubricMiddleware** was added in **deepagents 0.6.5** per the GitHub Releases page ("RubricMiddleware for self-evaluated agent iteration (#3529)", dated 27 May) and the docs state "RubricMiddleware requires deepagents>=0.6.5. It is in beta; the API may change in the future." Entirely uncovered today.
- **Interpreter middleware via langchain-quickjs** shipped in **deepagents-code 0.1.4** per GitHub Releases ("Interpreter middleware via langchain-quickjs (#3525)", dated 21 May).
- **LangSmith Sandbox** backend exists ("LangSmith sandboxes are currently in private beta") alongside Modal/Daytona/Runloop/AgentCore.
- **Harness/provider profiles** require deepagents>=0.5.4 and are public beta ("Harness and provider profiles are Python-only and require `deepagents>=0.5.4`. They are public beta APIs").

### The six gap areas
1. **Filesystem depth** — FilesystemPermission semantics, the virtual_mode security model, the six file tools + execute, multimodal read_file, tool_token_limit_before_evict (default 20000), large-result offloading.
2. **Harness + Claude integration** — the full HarnessProfile field surface, prompt-assembly slots, AnthropicPromptCachingMiddleware, and the built-in Claude/Codex profiles.
3. **Sandbox depth** — BaseSandbox, the execute()-only provider contract, lifecycle/scoping, the two integration patterns, and the secrets security model.
4. **Subagents + async** — sync vs async, the async_tasks state channel, the five async tools, and Agent Protocol/ASGI transport.
5. **Skills + memory** — the progressive-disclosure 3-level model, SKILL.md authoring, MemoryMiddleware/AGENTS.md, and source layering.
6. **Codegen / dcode** — the Deep Agents Code CLI, Terminal-Bench 2.0 results, the QuickJS interpreter, and CI/headless usage.

---

## Details

### Proposal 1 — `deepagents-filesystem`

**Justification.** FilesystemMiddleware is the backbone of the harness — skills, memory, code execution, and context management all ride on it ("The virtual filesystem is used by several other harness capabilities such as skills, memory, code execution, and context management"). Yet its security model is widely misunderstood: the official reference is blunt that virtual_mode is not a sandbox. A dedicated skill stops developers from assuming `FilesystemBackend(root_dir=...)` is safe.

**APIs/classes covered:**
- `FilesystemMiddleware(backend=..., tool_token_limit_before_evict=20000)` — adds `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`; adds `execute` only when the backend implements `SandboxBackendProtocol` ("If the backend implements SandboxBackendProtocol, an `execute` tool is also added").
- `FilesystemPermission` dataclass: `operations: list[Literal["read","write"]]`, `paths: list[str]`, `mode: Literal["allow","deny"]="allow"`. Validation requires paths to start with `/` and forbids `..` or `~`.
- Default tool→operation map (from source): ls/read_file/glob/grep = read; write_file/edit_file = write.
- `FilesystemBackend(root_dir=".", virtual_mode=True)`.
- Internal data paths written automatically: `/large_tool_results/` and `/conversation_history/`.

**Key code pattern:**
```python
from deepagents import create_deep_agent, FilesystemPermission
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=CompositeBackend(
        default=StateBackend(),
        routes={"/memories/": StoreBackend(namespace=lambda rt: (rt.server_info.user.identity,))},
    ),
    permissions=[FilesystemPermission(operations=["write"], paths=["/policies/**"], mode="deny")],
)
```

**Gotchas to document:**
- `virtual_mode=False` (the default) "provides no security even with root_dir set." `virtual_mode=True` blocks traversal (`..`, `~`) and absolute paths outside root_dir but "does not provide sandboxing or process isolation."
- `tool_token_limit_before_evict` default is 20000 tokens (~80K chars) and is **not** directly customizable via `create_deep_agent` — it is instantiated internally three times (main agent, general-purpose subagent, user subagents); the only escape today is monkey-patching or dropping to `create_agent` (open issue #2784). Large tool results above the limit are offloaded to the backend and replaced with a reference. (A separate, higher `TOOL_RESULT_TOKEN_LIMIT` of ~100k tokens governs immediate result offload.)
- Multimodal: from v0.5, images, audio, video, and PDFs are returned by `read_file` as multimodal content blocks; file type is auto-detected from extension; actual support depends on the model.
- `edit_file` requires reading the file first or it errors; exact indentation must be preserved; line-number prefixes must not appear in old_string/new_string.
- `grep` searches literal text (not regex) and can fall back from ripgrep to a slower path (logged since 0.6.5).

**Integration points:** backends, permissions, langchain-core messages (multimodal blocks), observability (MLflow/LangSmith traces of file ops).

**Trigger keywords:** filesystem, FilesystemMiddleware, FilesystemPermission, virtual_mode, read_file, write_file, edit_file, glob, grep, file offload, eviction, multimodal read, path traversal.

**Suggested sub-docs:** `permissions.md`, `virtual-mode-security.md`, `file-tools-reference.md`, `multimodal-files.md`.

---

### Proposal 2 — `deepagents-harness-and-claude`

**Justification.** Claude is the default model (historically `claude-sonnet-4-5-20250929`) and the harness ships Claude-specific profiles and prompt-caching behavior. Prompt-assembly order and cache_control interactions are subtle and cause real production failures (e.g., AnthropicPromptCachingMiddleware breaking ModelFallbackMiddleware, issue #33709).

**APIs/classes covered (HarnessProfile, deepagents>=0.5.4, public beta):** the documented seven fields are
- `base_system_prompt` — "Replace the base Deep Agents system prompt (CUSTOM in Prompt assembly)."
- `system_prompt_suffix` — "Append text to the assembled base prompt (SUFFIX in Prompt assembly); applied to the main agent, declarative subagents, and the auto-added general-purpose subagent."
- `tool_description_overrides` — "Override individual tool descriptions, keyed by tool name."
- `excluded_tools` — "Remove specific harness-level tools from the tool set."
- `excluded_middleware` — "Strip specific middleware classes from the stack. Accepts middleware classes or string names."
- `extra_middleware` — "Append middleware to every stack this profile applies to."
- `general_purpose_subagent` (a `GeneralPurposeSubagentProfile` with `enabled` and `system_prompt`) — "Disable, rename, or re-prompt the general-purpose subagent."

Plus `HarnessProfileConfig` (YAML/JSON-friendly subset), `register_harness_profile(key, profile)`, and `AnthropicPromptCachingMiddleware(type="ephemeral", ttl="5m"|"1h", unsupported_model_behavior=...)`.

**Key code pattern:**
```python
from deepagents import HarnessProfile, register_harness_profile, GeneralPurposeSubagentProfile
register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(
        system_prompt_suffix="Respond in under 100 words.",
        excluded_tools=frozenset({"execute"}),
        general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False),
    ),
)
```

**Facts to document:**
- Prompt assembly order is always **USER → (BASE or CUSTOM) → SUFFIX**, joined by blank lines (`\n\n`). Two invariants: "USER is always at the front, so caller instructions take precedence"; "SUFFIX is always at the end, so model-tuning guidance sits closest to the conversation history." `base_system_prompt` replaces BASE outright as CUSTOM.
- When `system_prompt=` is a `SystemMessage` (not a string), "the right-hand assembly is appended as an additional text content block onto the message's existing content_blocks list, preserving any cache_control markers the caller set."
- Built-in profiles ship for **OpenAI and Anthropic (Claude)** per the docs; the blog additionally claims Google (treat as unconfirmed — docs/blog disagree). Confirmed Claude registrations: **Sonnet 4.6, Opus 4.7, Haiku 4.5**. The **Codex** profile overrides the edit tool with `apply_patch` and aliases `execute` as `shell_command`, plus adds parallel-tool-call planning prompts; the **Opus** profile adds `<tool_result_reflection>` and `<tool_usage>` prompt blocks.
- Merge semantics on re-registration are additive: "Re-registering under an existing key merges the new profile on top of the prior one—it does not replace it." Per field: prompt strings — new value wins or inherits; `tool_description_overrides` — mappings merge per key; `excluded_tools`/`excluded_middleware` — set union; `extra_middleware` — merged by concrete class; `general_purpose_subagent` — field-wise.
- `excluded_middleware` cannot remove scaffolding — "Listing FilesystemMiddleware, SubAgentMiddleware, or the internal permission middleware raises a ValueError."
- MemoryMiddleware is placed after Anthropic prompt caching "so updates to injected memory are less likely to invalidate the Anthropic cache prefix."
- **AnthropicPromptCachingMiddleware** behavior: tags the last system-message block, all tool definitions, and the last cacheable message block with cache_control. Cost (per Anthropic's official prompt-caching docs): "Cache writes... 25% more than base input tokens for 5-minute TTL... Cache reads... 10% of base input token price."
- Known bugs to warn about: cache_control leaks to non-Anthropic fallback models causing `TypeError: unexpected keyword argument 'cache_control'` (issue #33709); AWS Bedrock uses `cachePoint` blocks, not `cache_control`, so DeepAgents prompt caching is stripped on Bedrock (issue #917).

**Trigger keywords:** HarnessProfile, register_harness_profile, prompt caching, cache_control, claude-sonnet-4-6, claude-opus-4-7, system prompt assembly, SystemMessage, profiles, Codex profile, apply_patch.

**Suggested sub-docs:** `harness-profiles.md`, `prompt-assembly.md`, `anthropic-caching.md`, `claude-defaults.md`.

---

### Proposal 3 — `deepagents-sandbox`

**Justification.** Sandboxes are the only real security boundary in a "trust the LLM" harness, and the docs carry a strong, specific warning: "Never put secrets inside a sandbox." The provider contract (implement only `execute()`) and lifecycle/scoping decisions are non-obvious and easy to get wrong (orphaned billable sandboxes).

**APIs/classes covered:**
- `BaseSandbox` and `SandboxBackendProtocol` — "the only method a provider must implement is `execute()`... Every other filesystem operation (read, write, edit, ls, glob, grep) is built on top of `execute()` by the BaseSandbox base class." The `execute` tool is filtered out on every model call if the backend doesn't implement `SandboxBackendProtocol`.
- Provider backends: `ModalSandbox`, `DaytonaSandbox`, `RunloopSandbox`, `AgentCoreSandbox`, and `LangSmithSandbox` (private beta).
- File-transfer APIs: `upload_files([(absolute_path, bytes)])` to seed, `download_files([paths])` to retrieve artifacts.
- `execute(command)` returns combined stdout/stderr, exit code, and a truncation notice (large output is auto-saved to a file for incremental `read_file`).
- Lifecycle/scoping: thread-scoped (default — "Each conversation gets its own sandbox") vs assistant-scoped ("All threads for a given assistant share one sandbox"); configure TTL; get-or-create by `thread_id` label.

**Key patterns:** "sandbox as tool" (recommended — API keys stay outside, pay per execution, parallel sandboxes) vs "agent in sandbox" (mirrors local dev but secrets live inside and updates need image rebuilds). Document the **two planes of file access**: agent fs tools route through `execute()` inside the sandbox; application-side `upload_files`/`download_files` use the provider's native transfer APIs.

**Security model to document:** sandboxes do **not** protect against context injection or network exfiltration ("Unless network access is blocked, a context-injected agent can send data out... e.g. `blockNetwork: true` on Modal"). Keep secrets in host-side tools or a credential-injecting proxy; enable HITL on all tool calls if secrets must be injected; treat everything produced inside the sandbox as untrusted input.

**Trigger keywords:** sandbox, Modal, Daytona, Runloop, AgentCore, LangSmithSandbox, BaseSandbox, SandboxBackendProtocol, execute, upload_files, download_files, sandbox lifecycle, TTL, secrets.

**Suggested sub-docs:** `provider-setup.md`, `lifecycle-scoping.md`, `integration-patterns.md`, `sandbox-security.md`.

---

### Proposal 4 — `deepagents-subagents-and-async`

**Justification.** Async subagents (v0.5, released 7 April 2026) introduced five new tools, a dedicated state channel, and an Agent Protocol/ASGI transport model — a significant surface a one-file reference cannot capture. The compaction-survival design of the async_tasks channel is a subtle correctness detail.

**APIs/classes covered:**
- Sync: `SubAgent` TypedDict, `CompiledSubAgent`, the `task` tool, `response_format` for structured output, per-subagent `interrupt_on` (can require approval even when the parent doesn't).
- Async: `AsyncSubAgent` TypedDict (name, description, graph_id, optional `url`), `AsyncSubAgentMiddleware`, and the five tools — `start_async_task`, `check_async_task`, `update_async_task`, `cancel_async_task`, `list_async_tasks`.
- The `async_tasks` state channel — separate from message history so task IDs survive summarization: "If task IDs were only in tool messages, they would be lost during compaction. The dedicated channel ensures the supervisor can always recall its tasks through list_async_tasks." Each tracked task records task ID, agent name, thread ID, run ID, status, and timestamps.

**Facts to document:**
- Launch "creates a new thread on the server, starts a run with the task description as input, and returns the thread ID as the task ID. The supervisor reports this ID... and does not poll for completion."
- Update "creates a new run on the same thread with an interrupt multitask strategy" (`multitask_strategy="interrupt"`) — the subagent restarts with full conversation history plus new instructions, and the task ID stays the same.
- ASGI transport when `url` is omitted: "SDK calls are routed through in-process function calls rather than HTTP... requires both graphs to be registered in the same langgraph.json." Zero network latency, no extra auth.
- Any Agent Protocol-compliant server is a valid target (LangSmith deployments, custom FastAPI, etc.). LangChain chose Agent Protocol over ACP (stdio-only today) and A2A (kept lighter for faster iteration).
- Sync subagents get the default stack minus MemoryMiddleware and SubAgentMiddleware (no nesting); the harness auto-injects TodoList/Filesystem/Summarization before custom subagent middleware.
- Troubleshooting: model truncating `task_id` (add "never truncate the task_id" to the prompt or switch models); worker-pool exhaustion (increase `--n-jobs-per-worker`).

**Trigger keywords:** subagent, task tool, AsyncSubAgent, start_async_task, check_async_task, async_tasks channel, Agent Protocol, ASGI transport, multitask_strategy, parallel subagents, response_format.

**Suggested sub-docs:** `sync-subagents.md`, `async-subagents.md`, `agent-protocol-transport.md`, `parallel-patterns.md`.

---

### Proposal 5 — `deepagents-skills-and-memory`

**Justification.** This is meta-relevant: the plugin system itself authors SKILL.md files, so the team needs precise rules for frontmatter, progressive-disclosure levels, source precedence, and how skills differ from memory.

**APIs/classes covered:**
- `SkillsMiddleware(backend, sources=[...])` — sources can be bare paths or `(path, label)` tuples; "Sources are loaded in order, with later sources overriding earlier ones when skills have the same name (last one wins)," enabling base → user → project → team layering.
- Skill frontmatter (Agent Skills spec): `name`, `description` (max 1024 chars), `license`, `compatibility`, `metadata`, `allowed-tools`. Only SKILL.md is required; max file size 10MB (DoS guard).
- `MemoryMiddleware(backend, sources=["~/.deepagents/AGENTS.md", "./.deepagents/AGENTS.md"])` — always-loaded context wrapped in `<agent_memory>` tags, concatenated with later sources after earlier ones.
- `memory=[...]` and `skills=[...]` params on `create_deep_agent`.

**Facts to document:**
- Three-level progressive disclosure: L1 = name + description in the system prompt at startup; L2 = full SKILL.md read when invoked; L3 = supporting files read on demand. "Level 3 files stay on the backend until the agent reads them after invocation."
- Skills vs memory: "skills (which are on-demand workflows)" vs "memory is always loaded and provides persistent context." Guidance: memory for what the agent always needs, skills for what it might need occasionally.
- The agent persists learnings by calling `edit_file` on the AGENTS.md source; the MEMORY_SYSTEM_PROMPT forbids storing API keys/credentials or transient info ("I'm on my phone").
- CLI directory conventions: global `~/.deepagents/<agent>/agent.md` and `skills/`; project-level `[project-root]/.deepagents/agent.md` and `skills/` (auto-detected via `.git`); project skills override global ones by name.
- With `StateBackend` (default), seed skill files via `invoke(files={...})` using `create_file_data()` from `deepagents.backends.utils` (raw strings are not supported); with `FilesystemBackend`, skills load from disk relative to `root_dir`.

**Integration points:** prompt-engineering, langchain-core, developer-experience.

**Trigger keywords:** SKILL.md, SkillsMiddleware, progressive disclosure, AGENTS.md, MemoryMiddleware, skill frontmatter, agentskills.io, memory vs skills, .deepagents, create_file_data.

**Suggested sub-docs:** `skill-authoring.md`, `progressive-disclosure.md`, `agents-md-memory.md`, `source-precedence.md`.

---

### Proposal 6 — `deepagents-codegen-dcode`

**Justification.** Deep Agents Code (dcode) is the flagship coding agent and the documented Terminal-Bench baseline; CI/headless usage and the QuickJS interpreter are distinct workflows from the SDK.

**APIs/CLI covered:**
- Install: `curl -LsSf https://langch.in/dcode | bash`; or `uvx deepagents-cli`.
- Flags: `-n` (non-interactive single task), `-y` (auto-approve), `-m`, `--model`, `--sandbox` (modal/runloop/daytona), `--sandbox-setup`, `--sandbox-id`, `--sandbox-snapshot-name`, `-S`/`--shell-allow-list` (`recommended` or `all`), `--startup-cmd`, piped stdin (auto non-interactive). `/auth`, `/model`, `/trace` slash commands; incognito shell `!!`.
- `CodeInterpreterMiddleware` (Python, `from langchain_quickjs import CodeInterpreterMiddleware`) / `createCodeInterpreterMiddleware` (JS, `@langchain/quickjs`) — adds an `eval` tool running JS in QuickJS; programmatic tool calling via `ptc=[...]` allowlist.

**Facts to document:**
- **Terminal-Bench 2.0** (official LangChain blog): "We ran the DeepAgents CLI with claude-sonnet-4-5 on Terminal Bench 2.0 across 2 trials, achieving scores of 44.9% and 40.4% (mean: 42.65%). This baseline is on par with other implementations using the same model." Evaluated via the `harbor` package with a `HarborSandbox` backend, run at scale on Daytona (40 concurrent trials).
- QuickJS interpreter isolation: "By default, interpreter code has no access to the host filesystem, network, shell, package manager, or clock." PTC bridges only allowlisted tools; subagent dispatch is on by default; **PTC calls bypass `interrupt_on` approval** ("interruptOn approval workflows are not enforced per PTC-invoked tool call"). Treat QuickJS as a scoped runtime, not a production sandbox.
- Non-interactive mode "is instructed to make reasonable assumptions and proceed autonomously" and favors non-interactive command variants (`npm init -y`, `apt-get install -y`); each `-n` run starts a fresh thread (file-based state persists). `-S all` lets the agent run arbitrary shell with no confirmation — document as dangerous.
- LangSmith dual tracing: set `DEEPAGENTS_LANGSMITH_PROJECT` to separate agent traces from user-code (shell) traces.

**Integration points:** observability (LangSmith), testing-foundations, deepagents-sandbox.

**Trigger keywords:** dcode, deepagents-cli, Deep Agents Code, Terminal-Bench, CodeInterpreterMiddleware, QuickJS, eval tool, programmatic tool calling, headless, CI, -y, shell-allow-list.

**Suggested sub-docs:** `dcode-cli.md`, `headless-ci.md`, `quickjs-interpreter.md`, `terminal-bench.md`.

---

### Optional Proposal 7 — `deepagents-rubric-and-eval`
**RubricMiddleware** (deepagents>=0.6.5, beta) drives a dedicated grader subagent that scores output against a rubric and iterates until satisfied or `max_iterations` is hit ("evaluation is handled by a dedicated grader sub-agent that can call tools, reason over the full transcript, and return per-criterion feedback"). Pass the rubric as a newline-delimited checklist on invocation state; the middleware does not run when no rubric is supplied. It applies the LLM-as-judge pattern at runtime and couples tightly with the existing `llm-evaluation` and `observability` skills.

```python
from deepagents import RubricMiddleware, create_deep_agent
agent = create_deep_agent(
    model="google_genai:gemini-3.5-flash",
    middleware=[RubricMiddleware(model="anthropic:claude-haiku-4-5", max_iterations=3)],
)
```
This could be folded into `deepagents-harness-and-claude` if seven skills is too many; I recommend keeping it separate because its natural integration partners are the eval/observability skills, not the harness skill.

---

## Source Scoring
- `docs.langchain.com/oss/python/deepagents/*` — official documentation — **10/10**
- `reference.langchain.com/python/deepagents/*` — official API reference — **10/10**
- `github.com/langchain-ai/deepagents` (README, source, issues #2784/#917/#33709, Releases) — official repo — **9/10**
- `pypi.org/project/deepagents` — official package metadata (version confirmation) — **9/10**
- `langchain.com/blog` and `changelog.langchain.com` — official blog/changelog — **8/10**
- `platform.claude.com` Anthropic prompt-caching docs (cache cost figures) — official vendor — **9/10**
- `deepwiki.com/langchain-ai/deepagents` — third-party auto-generated wiki citing source files — **6/10**
- Medium / Towards AI / Flowtivity / BSWEN / Analytics Vidhya tutorials — third-party — **4/10**

## Recommendations
1. **Build first (highest security/correctness impact, most-used surfaces):** `deepagents-filesystem`, `deepagents-sandbox`, `deepagents-skills-and-memory`. The filesystem and sandbox skills directly counter the most dangerous misconception in the library — that `virtual_mode`/`root_dir` provides isolation — and the skills/memory skill is the one the plugin authors will use most.
2. **Build second:** `deepagents-harness-and-claude` and `deepagents-subagents-and-async` — high value but more specialized; ship after the foundational three.
3. **Build third:** `deepagents-codegen-dcode`, then the optional `deepagents-rubric-and-eval`.
4. **Immediately bump the base `deepagents.md`** stability matrix from v0.6.7 to **v0.6.10** and add rows for RubricMiddleware (0.6.5), the QuickJS interpreter middleware (deepagents-code 0.1.4), and the LangSmith sandbox beta — then convert `deepagents.md` into a router that points to the six new skills.

**Thresholds that would change this plan:** if deepagents promotes harness profiles or RubricMiddleware out of beta (watch the changelog), promote those skills up the build order. If the team's plugin targets only research/non-coding agents, deprioritize `deepagents-codegen-dcode`. If a new major version (0.7+) ships breaking changes to the backend protocol, re-validate the filesystem and sandbox skills before publishing.

## Caveats
- deepagents is a fast-moving library; **harness profiles and RubricMiddleware are explicitly beta** and their APIs "may be updated in future releases" / "may change."
- Several model identifiers in the current docs (`gpt-5.5`, `claude-opus-4-8`, `gemini-3.5-flash`, `claude-sonnet-4-6`) reflect the June 2026 documentation snapshot; some may be forward-looking placeholders. Pin examples to the model names your environment actually supports.
- Docs and the official blog **disagree on whether Google harness profiles ship by default** (docs say OpenAI + Anthropic; blog adds Google). Treat Google profile support as unconfirmed until verified against the installed version.
- The OpenAI/Codex profile's edit-tool override is described as `apply_patch` replacing `file_edit` in the fully-fetched blog but `edit_file` in a search snippet — a minor wording inconsistency in the source; verify against the repo before quoting verbatim in a SKILL.md.
- DeepWiki line-number citations are auto-generated and should be checked against the actual source files before being reproduced in published skills.
# skills

A curated library of reusable skills for AI agents — structured Markdown instruction sets that agents load at runtime to complete specific task classes reliably.

## Background

Modern AI agents work best when given focused, composable capabilities rather than monolithic prompts. This repository provides a growing library of **skills** — discrete, well-scoped instruction sets — that agents can load at runtime to complete tasks in a consistent, predictable way.

Each skill is:

- **Self-contained** — all context an agent needs is in the skill file itself
- **Composable** — skills can be combined without conflict
- **Versioned** — breaking changes are tracked so downstream agents can pin to a specific version

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Skills Index](#skills-index)
- [Support](#support)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Installation

Clone the repository to wherever your agent runtime expects to resolve skills:

```bash
git clone https://github.com/josephsearle/agent-skills.git
```

No dependencies are required — skills are plain Markdown files.

## Usage

Point your agent at a skill file to load its instructions at runtime. The agent reads `SKILL.md` and follows its numbered steps.

**With Claude Code** — reference a skill in your `CLAUDE.md` or pass it directly in a session:

```bash
# Read a skill's instructions into the current session
cat skills/code-review/SKILL.md
```

**With a LangGraph or CrewAI agent** — load the skill content and inject it into the system prompt:

```python
from pathlib import Path

skill = Path("skills/code-review/SKILL.md").read_text()
# Pass `skill` as the system message or a tool response in your agent graph
```

**With any agent** — skills are plain text and work with any framework that can read a file and include its contents in a prompt.

### Reference files

Many skills load additional context from their `references/` subdirectory (language-specific rules, framework guides, scenario templates). The skill's numbered steps tell the agent exactly which reference files to load and under what conditions — they are not auto-loaded.

```
skills/
  <skill-name>/
    SKILL.md            # the skill itself — always loaded
    references/
      universal.md      # always-loaded base standards (where applicable)
      <language>.md     # e.g. golang.md, python.md, typescript.md
      frameworks/       # framework-specific references
      scenarios/        # scenario-specific references
```

## Skills Index

| Skill | Description |
|-------|-------------|
| [architecture-docs](skills/architecture-docs/SKILL.md) | Generate comprehensive architectural documentation for a new or existing project: detects architecture style (Monolith, Microservices, Serverless, Event-Driven), scans the technology stack, inventories existing docs for gaps, and writes a complete `docs/architecture/` tree with native C4 Model Mermaid diagrams, Architecture Decision Records, and stakeholder-aware narrative sections |
| [archunitts-testing](skills/archunitts-testing/SKILL.md) | Implement, audit, and gap-analyse ArchUnitTS architecture tests for TypeScript projects; reads `docs/architecture/`, README, CONTRIBUTING, and AGENTS.md to enforce intended layer boundaries, cycle-freedom, framework isolation, and code metrics across layered, clean, hexagonal, MCP server, and NestJS module architectures |
| [bob-builder](skills/bob-builder/SKILL.md) | Create IBM Bob custom modes and skills, or analyse an existing project and recommend which modes, skills, and mode enhancements would improve developer workflows; scans stack, architecture docs, library imports, CI/CD maturity, and security posture to generate context-aware Bob configuration with full YAML and SKILL.md output |
| [code-review](skills/code-review/SKILL.md) | Perform structured code reviews on GitHub PRs: severity classification, inline and general comment posting, approval decisions, universal security checklist, and language-specific checks for Go, TypeScript, Python, and Terraform |
| [cv-writing](skills/cv-writing/SKILL.md) | Create or tailor a UK-format CV for AI/ML engineers targeting scale-ups: two modes (CREATE from scratch / ENHANCE against a JD), ATS lint pass, XYZ bullet rewriting, JD keyword gap analysis, and a profile generator that mirrors the JD's top responsibilities |
| [dataset-preparation](skills/dataset-preparation/SKILL.md) | Transform raw data (CSV, JSON, PDF, images, audio) into Unsloth-compatible training datasets: detects target model type (LLM, Vision, TTS, Embedding), applies the correct chat template, and writes a `prepare_dataset.py` script to disk |
| [deepagents-codegen-dcode](skills/deepagents-codegen-dcode/SKILL.md) | Deep Agents Code CLI (`dcode`) and `CodeInterpreterMiddleware` — interactive and headless/CI coding agent, QuickJS JavaScript interpreter (`eval` tool, PTC allowlist, `interrupt_on` bypass warning), Terminal-Bench 2.0 baseline scores (42.65% mean on Sonnet 4.5), and `--shell-allow-list` safety guidance |
| [deepagents-filesystem](skills/deepagents-filesystem/SKILL.md) | Deep Agents filesystem layer — `FilesystemMiddleware`, `FilesystemPermission` (allow/deny path patterns), `virtual_mode` security model (traversal guard only, not a sandbox), all six file tools + conditional `execute`, `tool_token_limit_before_evict` eviction, and multimodal `read_file` (image/PDF/audio/video, deepagents v0.5+) |
| [deepagents-harness-and-claude](skills/deepagents-harness-and-claude/SKILL.md) | Deep Agents harness profiles and Claude integration — `HarnessProfile` seven fields, additive merge semantics, `register_harness_profile`, prompt assembly order (USER → BASE/CUSTOM → SUFFIX), `AnthropicPromptCachingMiddleware` (cost, `cache_control` leak bug #33709, Bedrock `cachePoint` bug #917), and built-in Sonnet/Opus/Haiku/Codex profiles |
| [deepagents-rubric-and-eval](skills/deepagents-rubric-and-eval/SKILL.md) | Deep Agents `RubricMiddleware` — LLM-as-judge runtime evaluation with a dedicated grader subagent, per-criterion feedback, configurable `max_iterations`, integration with `llm-evaluation` and `observability` skills, and multi-model grading patterns (deepagents>=0.6.5, beta) |
| [deepagents-sandbox](skills/deepagents-sandbox/SKILL.md) | Deep Agents sandbox layer — `BaseSandbox`, `SandboxBackendProtocol`, all five providers (Modal/Daytona/Runloop/AgentCore/LangSmith), thread vs assistant scoping, TTL and billing exposure, `upload_files`/`download_files`, "sandbox as tool" vs "agent in sandbox" integration patterns, and secrets/network-exfiltration security model |
| [deepagents-skills-and-memory](skills/deepagents-skills-and-memory/SKILL.md) | Deep Agents skills and memory system — SKILL.md authoring spec (frontmatter, max 1024-char description, `allowed-tools`), three-level progressive disclosure (L1 name+description / L2 full body / L3 reference files), `MemoryMiddleware`/AGENTS.md (always-loaded vs on-demand), source layering with last-wins precedence, and `create_file_data` for `StateBackend` seeding |
| [deepagents-subagents-and-async](skills/deepagents-subagents-and-async/SKILL.md) | Deep Agents sync and async subagents — `SubAgent` TypedDict, `CompiledSubAgent`, `task` tool, per-subagent `interrupt_on`, `AsyncSubAgent`, `AsyncSubAgentMiddleware`, five async tools (`start_async_task`, `check_async_task`, `update_async_task`, `cancel_async_task`, `list_async_tasks`), `async_tasks` state channel (survives compaction), Agent Protocol ASGI transport, and parallelism troubleshooting |
| [developer-experience](skills/developer-experience/SKILL.md) | Set up or audit the Python developer-experience toolchain for agentcraft projects: uv 0.11.x (PEP 735 dependency groups, lockfile, CI integration), Ruff 0.15.x (lint + format with ASYNC212 for agent code), Pyright 1.1.410 (local `uv run` hook only), pre-commit with hook ordering, and IBM detect-secrets with LLM codebase false-positive management |
| [mcp-builder](skills/mcp-builder/SKILL.md) | Develop and audit tools, resources, and prompts on NestJS MCP servers templated from the ITZ hardened template: enforces TechzoneAuthGuard JWT auth, two-layer CASL authorisation, per-user Redis rate limiting, Zod input validation, ToolBusinessError error channels, CloudEvents logging, and co-located Jest tests |
| [git-workflow](skills/git-workflow/SKILL.md) | Manage a GitHub repository end-to-end: branching strategy, Conventional Commits v1.0.0, pull requests, merging, releases, and branch cleanup — with MCP server, `gh` CLI, and `git` CLI tooling guidance |
| [jira-ticket-creation](skills/jira-ticket-creation/SKILL.md) | Create well-structured Jira tickets for Story, Bug, Epic, Task, Feature, Test Case, and Improvement via the Atlassian MCP: classifies work using SAFe/Atlassian hierarchy logic, gathers required fields conversationally, validates INVEST/measurable-AC/outcome-framing quality rules, and requires explicit confirmation before creating |
| [langchain-core](skills/langchain-core/SKILL.md) | LangChain Core & LCEL — Runnables, `init_chat_model` (all 26 provider prefixes), pipe syntax, `astream_events`, `RunnableConfig`, `with_structured_output` strategies, `ChatPromptTemplate`, `BaseCallbackHandler`, `CacheBackedEmbeddings`, `create_agent` factory with all AgentMiddleware patterns, and migration from deprecated chains (`LLMChain`, `RetrievalQA`, `AgentExecutor`) to modern LCEL and v1 agents |
| [langchain-providers](skills/langchain-providers/SKILL.md) | Provider configuration and reliability for all major LLM backends: `ChatOpenAI`, `ChatAnthropic`, `ChatBedrockConverse`, `ChatOllama`, `ChatMistralAI`, `ChatGroq`, `ChatHuggingFace`, `ChatCohere`, `AzureChatOpenAI` — extended thinking, reasoning models, cross-region inference, `InMemoryRateLimiter`, `.with_retry()`, `.with_fallbacks()`, and per-provider exception-type tables |
| [langchain-rag](skills/langchain-rag/SKILL.md) | Build and optimise production RAG pipelines with LangChain: idempotent ingestion via SQLRecordManager and index()/aindex(), per-store reference for PGVectorStore, Pinecone, Qdrant, Milvus, MongoDB Atlas, Elasticsearch, Redis, and Weaviate, chunking strategy selection, retriever patterns (MMR, EnsembleRetriever, ParentDocumentRetriever, SelfQueryRetriever), two-stage reranking (CohereRerank, CrossEncoderReranker), RAGAS testability contract (expose `retrieval_context: list[str]` separately), and advanced RAG architectures as LangGraph StateGraphs (Self-RAG, CRAG, HyDE, Adaptive RAG) |
| [langchain-tools-mcp](skills/langchain-tools-mcp/SKILL.md) | Tools, MCP client integration, and structured output — `@tool`, `BaseTool`, `StructuredTool.from_function`, `InjectedToolCallId`, `InjectedToolArg`, `content_and_artifact`, `MultiServerMCPClient`, `StdioConnection`, `StreamableHttpConnection`, server-side tools (web_search, code_interpreter, computer_use, web_fetch, text_editor), and all `with_structured_output` strategies with provider-specific gotchas |
| [langgraph-core](skills/langgraph-core/SKILL.md) | LangGraph 1.x runtime — `StateGraph`, checkpointers (`AsyncPostgresSaver`, `InMemorySaver`), HITL (`interrupt()`, `Command(resume=`), all 7 `stream_mode` values, `BaseStore`, `PostgresStore`, `@entrypoint`/`@task` functional API, time-travel, subgraph composition, `Send` for map-reduce fan-out, and MLflow tracing via `mlflow.langchain.autolog()` |
| [langgraph-memory](skills/langgraph-memory/SKILL.md) | Memory management for LangGraph agents — `trim_messages`, `SummarizationNode`, `LangMem` (0.0.x), `PostgresStore`, cross-thread memory via `InjectedStore`, short-term context overflow handling, long-term store patterns, `ReflectionExecutor` background consolidation, migration from `ConversationBufferMemory`/`ConversationSummaryMemory`, and test isolation patterns using `InMemorySaver` (see `testing-foundations`) |
| [langgraph-multiagent](skills/langgraph-multiagent/SKILL.md) | Multi-agent system patterns — supervisor, swarm, `create_deep_agent` (deepagents 0.6.10; for subsystem depth see the `deepagents-*` skills), `RemoteGraph` (see `langgraph-deployment` for self-hosted server), `langgraph-bigtool`, `create_handoff_tool`, `Command(goto=`, `Command.PARENT`, `SubAgentMiddleware`, `SkillsMiddleware`, `AgentsMdMiddleware`, the 5 official LangChain patterns with token call-count benchmarks, and MLflow multi-agent span tracing |
| [langgraph-deployment](skills/langgraph-deployment/SKILL.md) | Deploy and operate self-hosted LangGraph Server: `langgraph.json` schema, `langgraph build`/`langgraph dev` CLI, production topology (stateless replicas + Postgres + Redis), horizontal scaling, LangGraph SDK client (`get_client`, thread/run/assistant management), `RemoteGraph`, SSE streaming, and custom auth handlers |
| [llm-eval-generation](skills/llm-eval-generation/SKILL.md) | Generate evaluation tests for LLM-integrated code: RAG pipelines, agents, tool-calling systems, structured output, chatbots, and code generators — grounded in ISO 42001, NIST AI RMF, HELM, and the OpenAI Skill Eval Framework, with scenario-specific metrics and framework guidance for DeepEval, RAGAS, and Promptfoo |
| [llm-evaluation](skills/llm-evaluation/SKILL.md) | Design and implement agentcraft LLM evaluation suites using DeepEval 3.9.9 and RAGAS 0.4.3, with MLflow as the tracking backend: independent eval-repo architecture, agent contract design (`retrieval_context`, `tools_called` exposure), `LLMTestCase`, `ConversationalTestCase`, `EvaluationDataset`, RAGAS metrics and `TestsetGenerator`, MLflow scorer integration, CI gates, and judge-LLM cost management |
| [mcp-architecture-docs](skills/mcp-architecture-docs/SKILL.md) | Generate or gap-fill architectural documentation for NestJS MCP servers: MCP-aware C4 Mermaid diagrams (Host/Client/Server/Transport/Tool layers), MCP-specific ADR stubs (transport, statefulness, OAuth, capabilities, deployment, rate limiting), and stakeholder sections pre-populated with MCP risks, glossary terms, and cross-cutting concerns; AUDIT mode scores docs against MCP documentation coverage |
| [mcp-auth-guardian](skills/mcp-auth-guardian/SKILL.md) | Configure and audit OAuth 2.1 resource-server authorization for NestJS MCP servers: PRM endpoint (RFC 9728), JWT guards with JWKS validation, PKCE, per-tool @ToolScopes/@ToolRoles decorators, aud claim enforcement, and confused-deputy/token-pass-through prevention |
| [mcp-deployment-packager](skills/mcp-deployment-packager/SKILL.md) | Package and audit NestJS MCP servers for production containers: multi-stage Dockerfiles (UBI 10 or distroless), non-root USER, HEALTHCHECK, Trivy/Grype vulnerability CI gate, Kubernetes Deployment manifests with liveness/readiness probes, SIGTERM drain, and resource limits |
| [mcp-observability](skills/mcp-observability/SKILL.md) | Configure and audit observability for NestJS MCP servers: nestjs-pino structured logging with sensitive-field redaction, OpenTelemetry tracing with first-import initialisation, tool-call audit interceptor (hashed args + result), Terminus /healthz + /readyz endpoints, and graceful shutdown hooks |
| [mcp-rate-limiter](skills/mcp-rate-limiter/SKILL.md) | Configure and audit rate limiting for NestJS MCP servers: dual fixed-window throttler (per-IP + per-token), Redis-backed ThrottlerStorageRedisService for multi-instance deployments, custom getTracker guard, IETF RateLimit-* headers, and infrastructure path exclusions |
| [mcp-security-docs](skills/mcp-security-docs/SKILL.md) | Generate and audit security documentation for MCP server projects: SECURITY.md, security-insights.yml, STRIDE threat model, CVD process, .well-known/security.txt, and incident response plan; scores against OSPS Baseline L1–L3 controls with MCP-specific checks for tool poisoning, token passthrough, and confused-deputy |
| [mcp-resource-prompt-designer](skills/mcp-resource-prompt-designer/SKILL.md) | Design and audit MCP resource and prompt definitions in NestJS: @Resource and @ResourceTemplate providers with URI schemes, MIME types, RFC 6570 URI templates, completion handlers, and @Prompt providers with injection-safe argument construction |
| [mcp-security-hardener](skills/mcp-security-hardener/SKILL.md) | Harden NestJS MCP servers against transport and injection attacks: Host/Origin header validation (DNS rebinding defence), CORS allowlist, SSRF prevention (private IP blocklist), command injection prevention (execFile vs exec), and prompt-injection/tool-poisoning sanitisation |
| [mcp-server-architect](skills/mcp-server-architect/SKILL.md) | Design and audit the top-level architecture of a production NestJS MCP server: transport selection (stdio vs Streamable HTTP), stateless vs stateful mode, NestJS module layout, dependency selection, capability negotiation, and environment schema |
| [mcp-tool-designer](skills/mcp-tool-designer/SKILL.md) | Design and audit MCP tool definitions in NestJS: @Tool-decorated providers with Zod input schemas, correct annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint), proper error-channel selection (JSON-RPC vs isError), and an automated audit script for T001–T007 findings |
| [milvus-collection-lifecycle](skills/milvus-collection-lifecycle/SKILL.md) | Create, load, release, inspect, rename, or drop a Milvus collection: covers quick-setup and full-schema creation paths, shard and replica configuration, alias-based blue-green deploys, and collection state verification |
| [milvus-connection-auth](skills/milvus-connection-auth/SKILL.md) | Establish and validate a PyMilvus or MCP connection to any Milvus deployment: URI format selection, all three authentication modes (no-auth, username+password, token), MCP server configuration, and connection troubleshooting |
| [milvus-context](skills/milvus-context/SKILL.md) | Shared reference card loaded before every other milvus-* skill: deployment modes, cluster-wide limits, index type catalogue, consistency levels, schema constraints, scalar index types, and a deployment-override section for operators |
| [milvus-backup-restore](skills/milvus-backup-restore/SKILL.md) | Back up and restore Milvus collections using the milvus-backup CLI: create and verify backups, test restore after every backup, cross-environment promotion, and quarterly restore discipline; includes a fully-commented backup.yaml template for MinIO, S3, GCS, and Azure Blob |
| [milvus-diagnostics](skills/milvus-diagnostics/SKILL.md) | Diagnose and fix Milvus problems: decision-tree triage for slow search, wrong results, auth failures, ingestion errors, and empty results; coordinates all other milvus-* skills for remediation; includes an incident log template |
| [milvus-collection-lifecycle](skills/milvus-collection-lifecycle/SKILL.md) | Create, load, release, inspect, rename, or drop a Milvus collection: covers quick-setup and full-schema creation paths, shard and replica configuration, alias-based blue-green deploys, and collection state verification |
| [milvus-connection-auth](skills/milvus-connection-auth/SKILL.md) | Establish and validate a PyMilvus or MCP connection to any Milvus deployment: URI format selection, all three authentication modes (no-auth, username+password, token), MCP server configuration, and connection troubleshooting |
| [milvus-context](skills/milvus-context/SKILL.md) | Shared reference card loaded before every other milvus-* skill: deployment modes, cluster-wide limits, index type catalogue, consistency levels, schema constraints, scalar index types, and a deployment-override section for operators |
| [milvus-data-ingestion](skills/milvus-data-ingestion/SKILL.md) | Insert, upsert, delete, and bulk-insert data into Milvus: universal batch-size calculation, flush discipline, mass-delete strategy, PyMilvus bulk insert with polling, and ingestion failure troubleshooting |
| [milvus-index-management](skills/milvus-index-management/SKILL.md) | Choose, build, and tune a Milvus vector index: decision tree for HNSW, IVF_FLAT, IVF_PQ, SCANN, DISKANN, and GPU indexes; index_params reference; post-creation change via PyMilvus fallback; scalar index types for filter performance |
| [milvus-lifecycle-compaction-ttl](skills/milvus-lifecycle-compaction-ttl/SKILL.md) | Manage Milvus collection TTL, compaction, and cold-data lifecycle: set TTL for auto-expiry, trigger and monitor manual compaction, decide compact vs rebuild, tune segment size, and manage cold collection release |
| [milvus-multi-tenancy](skills/milvus-multi-tenancy/SKILL.md) | Design multi-tenant isolation for Milvus: strategy decision table (database / collection / partition / partition-key), resource group configuration for Distributed deployments, RBAC setup, and tenant isolation verification |
| [milvus-observability](skills/milvus-observability/SKILL.md) | Set up Milvus monitoring: Prometheus scrape configuration, six key metrics with alert thresholds, the four essential Grafana panels (Slow-Query, Search-Latency-by-Phase, Compaction-Task-Count, Insert-Throughput), SLO baselines, and structured log markers to watch |
| [milvus-schema-design](skills/milvus-schema-design/SKILL.md) | Design a Milvus collection schema before creation: immutability checklist, field type reference, BM25 Function setup, metric type selection, and worked examples for simple RAG, multi-vector hybrid search, and multi-tenant partition-key collections |
| [milvus-search-optimization](skills/milvus-search-optimization/SKILL.md) | Build and tune all Milvus search patterns: vector ANN search, scalar filter queries, BM25 text search, hybrid search with RRF and weighted rerankers, grouping search, and result verification; includes search-param-tuning reference for ef/nprobe sweep tables |
| [model-deployment](skills/model-deployment/SKILL.md) | Export a fine-tuned Unsloth model and generate deployment configuration: selects export format (GGUF, merged 16-bit, LoRA adapter) and writes `export.py` plus platform-specific deployment commands for Ollama, vLLM (including LoRA hot swap), SGLang, LM Studio, and llama-server |
| [model-finetuning](skills/model-finetuning/SKILL.md) | Generate a complete `train.py` using Unsloth for fine-tuning LLMs, Vision, Embedding, or TTS models: detects VRAM constraints, selects training method (QLoRA, LoRA, GRPO, DPO, CPT), configures hyperparameters, and writes a runnable training script with checkpoint and early-stopping configuration |
| [plugin-creation](skills/plugin-creation/SKILL.md) | Scaffold a Claude Code plugin from scratch or convert existing standalone `.claude/` configuration: generates the directory structure, `.claude-plugin/plugin.json` manifest, skill stubs, agent definitions, hook handlers, MCP server configs, and validates the result with `claude plugin validate` |
| [mlflow-observability](skills/mlflow-observability/SKILL.md) | Instrument, track, and evaluate agentcraft LangChain/LangGraph applications with MLflow 3.14.x: single-call instrumentation via `mlflow.langchain.autolog()`, Prompt Registry (`prompts:/<name>@<alias>` versioning, immutable versions, production/staging aliases), experiment tracking (`start_run`, `log_params`, `log_metrics`), and GenAI evaluation scorers (`Correctness`, `RelevanceToQuery`, `RetrievalGroundedness`, `ToolCallCorrectness`, DeepEval/RAGAS via MLflow) |
| [prompt-engineering](skills/prompt-engineering/SKILL.md) | Design and generate effective prompts for AI agents, graph nodes, and multi-agent pipelines — including MLflow Prompt Registry versioning, technique selection, archetype-based templates (ReAct, CoT, ToT, Reflexion, and more), and a prompt hardening checklist |
| [python-standards](skills/python-standards/SKILL.md) | Apply Python 3.10+ senior engineering standards: uv, pyproject.toml, Ruff, mypy + pyright type checking, concurrency pattern selection (asyncio / threading / free-threaded python3.14t), pytest + Hypothesis testing, and Google-style docstrings |
| [pr-generation](skills/pr-generation/SKILL.md) | Generate a high-quality GitHub pull request description and open the PR: detects or generates a project-appropriate PR template (Web/Frontend, Backend/API, Full-stack, Data/ML/AI, MCP/AI-agent), compresses the diff, fills the template with Claude via structured output, validates all required sections, and requires human approval at a mandatory gate before posting via `gh` CLI or GitHub API |
| [readme-generation](skills/readme-generation/SKILL.md) | Generate or update a project README.md to top industry standards: detects project type (library, CLI, web app, API, ML/data science), extracts metadata from package manifests, applies Standard-Readme spec and makeareadme.com guidelines, and produces all required sections with real, runnable examples |
| [skill-linting](skills/skill-linting/SKILL.md) | Review a SKILL.md file against all authoring standards: frontmatter validity, naming convention, body structure, README registration, trigger phrase presence, imperative voice in steps, reference file existence, and version correctness — produces a severity-classified Blocker/Major/Minor/Nit report with a PASS/FAIL verdict |
| [spike-generation](skills/spike-generation/SKILL.md) | Generate or update a technical spike document; detects spike type (technical, functional, architecture, research, design, prototyping, performance, usability, data); applies Beck/Cohn timebox principles and SAFe 6.0 Enabler Story standards; supports both create-from-scratch and gap-fill update modes |
| [test-generation](skills/test-generation/SKILL.md) | Generate unit tests, integration tests, and benchmarks for Python, TypeScript, and Go — grounded in ISO/IEC 29119, NIST IR 8397, and ISTQB conventions, with language-specific idioms for pytest, Jest/Vitest, and the Go testing package |
| [testing-foundations](skills/testing-foundations/SKILL.md) | Configure and write tests for agentcraft Python projects: pytest 8.4.x with `asyncio_mode = "auto"` and custom markers (`unit`/`integration`/`eval`), pytest-asyncio 1.x patterns (event_loop removal), LangChain/LangGraph mock fixtures (`FakeListChatModel`, `GenericFakeChatModel`, `InMemorySaver` function-scoped), Hypothesis property-based testing (`@given`, `RuleBasedStateMachine`, CI settings profiles), and DeepEval eval test separation |
| [turborepo-core](skills/turborepo-core/SKILL.md) | Configure and operate a Turborepo v2 monorepo build system: turbo.json task definitions (tasks/dependsOn/outputs/inputs/env/cache), turbo run and turbo watch, --filter and --affected for targeted execution, v1→v2 migration (pipeline→tasks), internal package strategy overview, turbo gen scaffolding, and Boundaries (experimental) |
| [turborepo-nestjs](skills/turborepo-nestjs/SKILL.md) | Configure a NestJS service inside a Turborepo monorepo: fix JIT-vs-compiled incompatibility ("cannot find module" at runtime), convert internal packages to compiled dist/ output or tsup bundles, wire @repo/database and @repo/auth shared packages, configure Jest/ts-jest, build production Docker images with turbo prune, and integrate Prisma db:generate as a task dependency |
| [turborepo-nextjs](skills/turborepo-nextjs/SKILL.md) | Configure a Next.js application inside a Turborepo monorepo: transpilePackages for internal JIT packages, per-path exports for @repo/ui, NEXT_PUBLIC_* Framework Inference, t3-env type-safe env schemas, next-env.d.ts handling, output: "standalone" with outputFileTracingRoot, and turbo prune multi-stage Dockerfile for Next.js |
| [turborepo-pnpm-workspaces](skills/turborepo-pnpm-workspaces/SKILL.md) | Configure and manage pnpm workspaces in a Turborepo monorepo: pnpm-workspace.yaml layout, workspace:* protocol for internal packages, pnpm catalogs for shared dependency version management, peer dependency patterns for shared UI libraries, and circular dependency detection and resolution |
| [turborepo-python-polyglot](skills/turborepo-python-polyglot/SKILL.md) | Add Python applications (LangChain, LangGraph, FastAPI) to a JS/TS Turborepo monorepo via package.json shims and uv: wire ruff/mypy/pytest as turbo tasks, configure uv workspaces for multiple Python packages, cache Python task outputs, manage cross-language contracts (OpenAPI/Pydantic/Zod), and understand what Turborepo does not do for Python |
| [turborepo-typescript](skills/turborepo-typescript/SKILL.md) | Configure TypeScript in a Turborepo monorepo: @repo/typescript-config shared tsconfig package, internal package strategy selection (JIT vs compiled vs transit node), TypeScript project references decision (not recommended), Node subpath imports as alternative to paths, and shared @repo/types packages |

## Support

Open an issue if you find a bug in a skill, have a feature request, or want to propose a new category.

## Roadmap

- [x] Automated skill validation on pull request (frontmatter linting)
- [ ] Skill versioning and changelog conventions
- [ ] Agent integration examples for Claude Code, LangGraph, and CrewAI
- [ ] Composite skill bundles (multiple skills loaded together)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for authoring guidelines, naming conventions, and the review process.

To add a new skill:

1. Fork the repository and create a feature branch
2. Create `skills/<domain>-<action>/SKILL.md` following the naming convention in `CONTRIBUTING.md`
3. Add a `references/` subdirectory for any language- or topic-specific files the skill loads
4. Complete all required frontmatter fields (`name`, `description`) — incomplete skills will not be merged
5. Update the Skills Index table in this README
6. Open a pull request with a short description of what the skill does and why it belongs here

## License

[MIT](LICENSE) © 2026 Joseph Searle

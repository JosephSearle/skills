# Bob Project Signals Reference

Use this reference during ANALYZE mode to map detected project signals to specific
IBM Bob mode and skill recommendations. Each section maps a signal (stack, library,
architecture, workflow) to concrete Bob configuration.

---

## 1. Stack Signals → Mode Recommendations

### TypeScript / Node.js Project

**Detection:** `package.json` present; primary source files are `.ts` / `.tsx`

| Signal | Recommended Mode | Key Config |
|---|---|---|
| NestJS (`@nestjs/core`) | `api-developer` | `fileRegex: ".*\\.(ts|spec\\.ts)$"`, `groups: [read, edit, mcp]` |
| Next.js / Remix (`next`, `remix`) | `fullstack-developer` | `fileRegex: ".*\\.(ts|tsx|css)$"`, `groups: [read, edit, browser]` |
| Express / Fastify | `backend-developer` | `fileRegex: ".*\\.(ts|js)$"`, `groups: [read, edit]` |
| MCP SDK (`@modelcontextprotocol/sdk`) | `mcp-developer` | `fileRegex: "src/.*\\.ts$"`, `groups: [read, edit, command]` |
| LangChain / LangGraph (`@langchain/*`) | `agent-developer` | See LangChain signal below |

**Starter mode for any TypeScript project:**
```yaml
- slug: ts-developer
  name: TypeScript Developer
  roleDefinition: >-
    You are a senior TypeScript engineer. You write idiomatic, type-safe TypeScript
    and follow the project's existing patterns without introducing unnecessary abstractions.
  customInstructions: >-
    Prefer explicit types over `any`. Use `interface` for object shapes unless a union
    or mapped type is needed. Always run `tsc --noEmit` mentally before suggesting output.
  groups:
    - read
    - edit
  fileRegex: ".*\\.(ts|tsx)$"
```

---

### Python Project

**Detection:** `pyproject.toml`, `requirements.txt`, or `setup.py` present

| Signal | Recommended Mode | Key Config |
|---|---|---|
| FastAPI (`fastapi`) | `api-developer` | `fileRegex: ".*\\.py$"`, Pydantic-aware instructions |
| Django (`django`) | `django-developer` | `fileRegex: ".*\\.py$"`, ORM and migration-aware instructions |
| Data science (`pandas`, `numpy`, `scikit-learn`) | `data-scientist` | `groups: [read, edit, command]` for running notebooks |
| ML training (`torch`, `tensorflow`, `transformers`) | `ml-engineer` | `groups: [read, edit, command]`, GPU/CUDA-aware instructions |
| LangChain / LangGraph (`langchain`, `langgraph`) | `agent-developer` | See LangChain signal below |
| pytest (`pytest`) | Skill: `test-runner` | See skill recommendation below |

**Starter mode for any Python project:**
```yaml
- slug: python-developer
  name: Python Developer
  roleDefinition: >-
    You are a senior Python engineer. You write idiomatic, type-annotated Python 3.11+
    following PEP 8 and PEP 484. You prefer explicit error handling over bare except clauses.
  customInstructions: >-
    Always include type annotations on function signatures.
    Use `pathlib.Path` instead of `os.path`.
    Prefer dataclasses or Pydantic models over plain dicts for structured data.
    Never use mutable default arguments.
  groups:
    - read
    - edit
  fileRegex: ".*\\.py$"
```

---

### JVM Project (Java / Kotlin)

**Detection:** `pom.xml` or `build.gradle` / `build.gradle.kts` present

| Signal | Recommended Mode | Key Config |
|---|---|---|
| Spring Boot (`spring-boot-starter`) | `spring-developer` | `fileRegex: ".*\\.(java|kt)$"` |
| Quarkus | `quarkus-developer` | `fileRegex: ".*\\.(java|kt)$"` |
| Android | `android-developer` | `fileRegex: ".*\\.(kt|xml)$"` |

---

### Go Project

**Detection:** `go.mod` present

```yaml
- slug: go-developer
  name: Go Developer
  roleDefinition: >-
    You are a senior Go engineer. You write idiomatic Go: short functions, explicit
    error returns, interfaces defined at the point of use, and zero-value-safe structs.
  customInstructions: >-
    Always handle errors explicitly — never use `_` to discard errors.
    Prefer table-driven tests with `t.Run`.
    Use `context.Context` as the first parameter for any function that does I/O.
  groups:
    - read
    - edit
  fileRegex: ".*\\.go$"
```

---

## 2. Library Signals → Mode & Skill Recommendations

### LangChain / LangGraph (Python or TypeScript)

**Detection:** `langchain`, `langgraph`, `@langchain/core`, `@langchain/langgraph` in dependencies

**Recommended Mode:**
```yaml
- slug: agent-developer
  name: Agent Developer
  roleDefinition: >-
    You are a senior LangGraph/LangChain engineer. You design and debug stateful agent
    pipelines: nodes, edges, conditional routing, interrupt/resume flows, and shared
    state schemas. You prioritise observable, testable agents over clever one-liners.
  customInstructions: >-
    Always type-annotate state schema with TypedDict (Python) or a typed interface (TS).
    Prefer `Command` returns over direct state mutation when rerouting.
    When debugging, read the LangSmith trace before the source code.
    Suggest `interrupt()` + human-in-the-loop patterns for approval workflows.
  groups:
    - read
    - edit
    - mcp
```

**Recommended Skills:**
- `agent-graph-debugger` — helps inspect LangGraph state, trace failed runs, identify stuck nodes
- `agent-node-generator` — scaffolds new LangGraph nodes with typed state, error handling, and tests

---

### MCP Server Development

**Detection:** `@modelcontextprotocol/sdk` (TypeScript) or `mcp` (Python) in dependencies

**Recommended Mode:**
```yaml
- slug: mcp-developer
  name: MCP Developer
  roleDefinition: >-
    You are an MCP server engineer. You design tools, resources, and prompts following
    the Model Context Protocol specification. You write well-described Zod/Pydantic schemas
    so LLMs can use tools correctly, and you always handle errors in a way that gives the
    LLM actionable feedback.
  customInstructions: >-
    Every tool parameter must have a `.describe()` annotation — this is the LLM's only
    documentation. Always test tools with a real MCP client before marking complete.
    Prefer intent-based tool names (verb_noun, e.g. `incident_resolve`) over CRUD wrappers.
  groups:
    - read
    - edit
    - command
```

---

### Testing Frameworks

| Detection | Recommendation |
|---|---|
| `pytest` in deps | Skill: `pytest-runner` — runs test suite, summarises failures, suggests fixes |
| `jest` or `vitest` in deps | Skill: `jest-runner` — same pattern for TypeScript |
| `deepeval`, `ragas`, `promptfoo` | Skill: `llm-eval-runner` — runs LLM evaluation suite and reports metric deltas |

---

### LLM Provider SDKs

**Detection:** `anthropic`, `openai`, `@anthropic-ai/sdk`, `@ai-sdk/*` in dependencies

**Recommended Mode:**
```yaml
- slug: llm-integrator
  name: LLM Integrator
  roleDefinition: >-
    You are a senior engineer integrating LLM APIs into production applications.
    You design prompt templates, tool/function call schemas, and streaming response
    handlers. You think about token costs, latency, and failure modes on every change.
  customInstructions: >-
    Always specify model ID explicitly — never rely on defaults that may change.
    Prefer structured output (tool use / response_format) over parsing freeform text.
    Add token usage logging on every LLM call.
    Test prompt changes with at least three diverse inputs before marking complete.
  groups:
    - read
    - edit
```

---

## 3. Architecture Pattern Signals → Mode Recommendations

### Microservices

**Detection:** Multiple `Dockerfile`s, multiple service directories, `docker-compose.yml`, service mesh config

**Recommended Mode Enhancement:**
Add to `roleDefinition`: "You are aware this is a distributed microservices system.
Before suggesting cross-service changes, always identify which services are affected
and whether API contracts will break."

**Recommended rules file:** `.bob/rules/01-microservices.md`
```markdown
This project is a microservices system. Before modifying any API endpoint or message
schema, identify all downstream consumers and flag potential breaking changes.
Prefer additive changes (new optional fields) over breaking changes (removed or renamed fields).
```

---

### Event-Driven Architecture

**Detection:** Kafka, RabbitMQ, AWS SQS, Azure Service Bus, Pub/Sub in dependencies or compose files

**Recommended Mode Enhancement:**
Add to `customInstructions`: "When modifying event schemas, always check for
consumers that will be affected. Flag any schema changes as potentially breaking."

---

### Serverless

**Detection:** `serverless.yml`, `sam.yaml`, `template.yaml` (AWS SAM), or `function.json` (Azure Functions)

**Recommended Mode:**
```yaml
- slug: serverless-developer
  name: Serverless Developer
  roleDefinition: >-
    You are a serverless engineer. You design Lambda/Cloud Functions that are
    stateless, fast to cold-start, and cost-efficient. You know that every MB of
    bundle size and every ms of init time costs money at scale.
  customInstructions: >-
    Prefer thin handlers that delegate to shared business logic modules.
    Always check if a proposed dependency increases bundle size significantly.
    Remind the developer to configure timeout and memory limits on new functions.
  groups:
    - read
    - edit
```

---

## 4. CI/CD & Workflow Signals → Recommendations

### GitHub Actions Present (`.github/workflows/`)

If CI workflows exist, recommend a `code-reviewer` mode with read-only access and
`customInstructions` that reference the CI gates:

```yaml
customInstructions: >-
  This project enforces CI gates. Before suggesting a merge, verify the change
  would pass: <list gates from the workflow files, e.g. lint, type-check, tests, security scan>.
```

Also recommend a **Bob rules file** that documents the CI policy:
```
.bob/rules/02-ci-policy.md
```

---

### Pre-commit Hooks (`.pre-commit-config.yaml`)

If pre-commit hooks are active, add to any mode's `customInstructions`:
"This project uses pre-commit hooks. Remind the developer to run `pre-commit run --all-files`
after any large refactor."

---

## 5. Documentation Pattern Signals

### `docs/architecture/` Present

If architecture docs exist (C4 diagrams, ADRs), recommend an `architecture-reviewer` mode:

```yaml
- slug: architecture-reviewer
  name: Architecture Reviewer
  roleDefinition: >-
    You are a software architect reviewing proposed changes against the documented
    architecture. You read ADRs and C4 diagrams before evaluating implementation choices.
    You flag deviations from architectural decisions and suggest when a new ADR is needed.
  customInstructions: >-
    Always read docs/architecture/ before commenting on structural decisions.
    When a change conflicts with an existing ADR, quote the ADR and explain the conflict.
    Suggest creating a new ADR when a change represents a significant architectural decision.
  groups:
    - read
```

---

### `CONTRIBUTING.md` Present

Read this file carefully. Extract:
- Branching strategy → add to any mode's `customInstructions`
- PR template requirements → recommend a `pr-author` mode or skill
- Code review process → inform `code-reviewer` mode instructions

---

## 6. Existing `.bob/` Config Signals

### Existing Custom Modes Found

For each existing mode:
1. Read its `roleDefinition` and `customInstructions`
2. Check if `groups` is overly permissive for the stated persona
3. Check if `fileRegex` is absent when it could reduce risk
4. Suggest specific additions to `customInstructions` based on detected stack/libraries

**Common enhancement patterns:**
- Add LangGraph-specific instructions to an `agent-developer` mode
- Tighten `fileRegex` to the mode's intended domain
- Add a mode-specific rules directory reference

### Existing Skills Found

For each existing skill:
1. Read its `description` — is it specific enough for Bob to auto-activate reliably?
2. Check if it references `references/` files that exist
3. Suggest description improvements if the trigger phrases are vague

### No `.bob/` Directory Found

Recommend starting with:
1. A primary developer mode matching the detected stack
2. A read-only reviewer mode (no `edit` group) for code review sessions
3. If Advanced mode will be used: at least one skill for the project's most repetitive workflow

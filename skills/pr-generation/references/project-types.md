# Project Types Reference

Detection decision tree and supplemental block definitions for each of the 6 supported
project types. Used by the `pr-generation` skill to select the correct supplemental PR
template block when no existing template is found. Check conditions in order — first match
wins.

---

## Detection Decision Tree

```
Step 1 — Check for AI / LangGraph signals (check first)

  Is langgraph.json present in the project root?
    └─ YES → project_type = "MCP / AI-agent"

  Does package.json declare @langchain/langgraph or @langchain/core?
    └─ YES → project_type = "MCP / AI-agent"

  Does pyproject.toml, requirements.txt, or setup.cfg declare:
    langgraph, langchain, langchain-core, crewai, autogen, pyautogen, pydantic-ai,
    openai-agents?
    └─ YES → project_type = "MCP / AI-agent"

  Are there *.mcp.ts files or an mcp.json in the project root?
    └─ YES → project_type = "MCP / AI-agent"


Step 2 — Check for ML / Data / AI signals

  Does pyproject.toml or requirements.txt declare:
    torch, tensorflow, sklearn, scikit-learn, transformers, xgboost,
    lightgbm, catboost, mlflow, wandb, ray[tune]?
    └─ YES → project_type = "Data / ML / AI"

  Are there *.ipynb notebook files at the project root or in a notebooks/ directory?
    └─ YES → project_type = "Data / ML / AI"

  Are there both a requirements.txt (or environment.yml) AND a data/ directory?
    └─ YES → project_type = "Data / ML / AI"


Step 3 — Check for Full-stack signals

  Does package.json declare BOTH:
    frontend deps (react, vue, next, nuxt, svelte, angular, solid, qwik)
    AND backend deps (express, fastify, nest, koa, hapi, elysia)?
    └─ YES → project_type = "Full-stack"

  Does the repo contain both a frontend/ (or client/) directory
    AND a backend/ (or server/ or api/) directory with separate package.json files?
    └─ YES → project_type = "Full-stack"


Step 4 — Check for Web / Frontend signals

  Does package.json declare:
    react, vue, next, nuxt, svelte, angular, solid, qwik, astro?
    (without backend deps from Step 3)
    └─ YES → project_type = "Web / Frontend"

  Are there *.tsx, *.jsx files at the project root or in a src/ directory?
    └─ YES → project_type = "Web / Frontend"

  Is there a tailwind.config.*, vite.config.*, or webpack.config.* file?
    └─ YES → project_type = "Web / Frontend"


Step 5 — Check for Backend / API signals

  Are there *.go files?
    └─ YES → project_type = "Backend / API"

  Does pyproject.toml or requirements.txt declare:
    fastapi, django, flask, starlette, aiohttp, tornado?
    └─ YES → project_type = "Backend / API"

  Does package.json declare:
    express, fastify, nest, koa, hapi, elysia?
    (without frontend deps)
    └─ YES → project_type = "Backend / API"

  Does the repo contain an openapi.yaml, openapi.json, or schema.graphql?
    └─ YES → project_type = "Backend / API"

  Does pom.xml or build.gradle declare Spring Boot or Quarkus?
    └─ YES → project_type = "Backend / API"


Step 6 — Fallback

  None of the above matched?
    └─ project_type = "Universal fallback"
       Use universal base template only; no supplemental block added
```

---

## Type 1: MCP / AI-agent

**Detection signals:** `langgraph.json`; `@langchain/langgraph`; `langgraph`/`langchain`/
`crewai`/`autogen`/`pydantic-ai`/`openai-agents` in Python deps; `mcp.json`; `*.mcp.ts`

### Supplemental sections to append

#### Affected Primitives

```markdown
## Affected Primitives

<!-- List each affected tool, resource, prompt, or graph node.
     Format: `primitive-name` — what changed and why. -->
```

#### Agent Behaviour Change

```markdown
## Agent Behaviour Change

<!-- Describe how agent behaviour changes from the user's perspective.
     Include: what inputs are handled differently, what outputs change,
     any new failure modes or edge-case handling. -->
```

#### Context-Window Cost Delta

```markdown
## Context-Window Cost Delta

<!-- Estimate the change in token consumption per invocation.
     Example: "+~800 tokens/call — added full schema to system prompt." -->
```

#### Prompt Injection Review

```markdown
## Prompt Injection Review

- [ ] New user-controlled inputs are sanitised before interpolation into prompts
- [ ] No secrets or API keys can be exfiltrated via tool outputs
- [ ] Tool schemas do not expose internal system paths or credentials
```

#### Integration Test Matrix

```markdown
## Integration Test Matrix

<!-- List the test scenarios added or updated for this change. -->

| Scenario | Expected output | Test location |
|---|---|---|
| | | |
```

---

## Type 2: Data / ML / AI

**Detection signals:** `torch`, `tensorflow`, `sklearn`, `transformers`, `xgboost`, `mlflow`,
`wandb` in Python deps; `*.ipynb` at root or in `notebooks/`; `data/` directory with
`requirements.txt` or `environment.yml`

### Supplemental sections to append

#### Experiment Run

```markdown
## Experiment Run

<!-- Link to the MLflow / W&B / Comet run for this change.
     Format: [Run name](URL) — brief description of the experiment setup. -->
```

#### Dataset Version

```markdown
## Dataset Version

<!-- Specify the dataset version used for evaluation.
     Include: name, version/commit/hash, source, and any preprocessing changes. -->
```

#### Metrics

```markdown
## Metrics

<!-- Report key metrics against the production baseline.
     Include fairness slices where applicable. -->

| Metric | Baseline (prod) | This PR | Delta |
|---|---|---|---|
| | | | |

Fairness slices (if applicable):

| Slice | Baseline | This PR |
|---|---|---|
| | | |
```

#### Model Card Update

```markdown
## Model Card Update

- [ ] Model card updated to reflect changes in intended use, limitations, or performance
- [ ] Bias and fairness evaluation conducted for affected slices
- [ ] Out-of-scope uses section reviewed
```

---

## Type 3: Full-stack

**Detection signals:** `package.json` with both frontend and backend deps; separate
`frontend/` and `backend/` directories with their own package files

### Supplemental sections to append

#### Deployment Order

```markdown
## Deployment Order

<!-- Specify the order in which services or packages must be deployed.
     Example: "Deploy API first (schema migration runs on startup), then deploy frontend." -->
```

#### Feature Flag

```markdown
## Feature Flag

<!-- If this change is gated by a feature flag: -->

- **Flag name:** `<flag-key>`
- **Rollout plan:** <!-- e.g. 5% → 25% → 100% over 2 weeks -->
- **Removal ticket:** <!-- Link to the ticket to remove the flag after full rollout -->
- **Fallback behaviour:** <!-- What happens when the flag is off -->
```

#### Backward Compatibility

```markdown
## Backward Compatibility

<!-- Specify the backward-compatibility window for this change.
     Example: "API v1 endpoints remain supported for 30 days post-deploy." -->
```

---

## Type 4: Web / Frontend

**Detection signals:** `react`, `vue`, `next`, `nuxt`, `svelte`, `angular`, `solid` in
`package.json`; `*.tsx`/`*.jsx` files; `tailwind.config.*`, `vite.config.*`

### Supplemental sections to append

#### Browser Matrix

```markdown
## Browser Matrix

<!-- Confirm which browsers were tested. -->

| Browser | Version | Tested |
|---|---|---|
| Chrome | latest | ☐ |
| Firefox | latest | ☐ |
| Safari | latest | ☐ |
| Edge | latest | ☐ |
| Mobile Safari (iOS) | latest | ☐ |
| Chrome Android | latest | ☐ |
```

#### Accessibility

```markdown
## Accessibility (WCAG 2.1 AA)

- [ ] Keyboard navigation tested
- [ ] Screen reader tested (VoiceOver / NVDA)
- [ ] Colour contrast meets 4.5:1 ratio for normal text, 3:1 for large text
- [ ] All interactive elements have visible focus indicators
- [ ] Images have descriptive `alt` text; decorative images have `alt=""`
- [ ] Form inputs have associated `<label>` elements
```

#### Visual Changes

```markdown
## Visual Changes

<!-- Before/after screenshots or a screen recording for any UI change.
     Delete this section if there are no visual changes. -->
```

#### Bundle Size Delta

```markdown
## Bundle Size Delta

<!-- Report the change in bundle size (use bundlephobia, webpack-bundle-analyzer, etc.).
     Example: "+12 KB gzipped (+2.1%) — imported charting library." -->
```

---

## Type 5: Backend / API

**Detection signals:** `*.go` files; `fastapi`, `django`, `flask` in Python deps; `express`,
`fastify`, `nest` in `package.json` (without frontend deps); `openapi.yaml`;
Spring Boot / Quarkus in Maven/Gradle

### Supplemental sections to append

#### API Contract

```markdown
## API Contract

<!-- Describe any changes to request/response shapes, status codes, or headers.
     Reference the diff line range for each change. -->
```

#### Migration Safety

```markdown
## Migration Safety

<!-- For database schema changes: confirm the migration is backward-compatible with
     the previous application version during the deployment window. -->

- [ ] Migration is additive-only (no column drops or renames in this PR)
- [ ] Tested against a production-sized dataset
- [ ] Rollback migration written and tested
```

#### Performance Benchmarks

```markdown
## Performance Benchmarks

<!-- Report latency and throughput for affected endpoints. -->

| Endpoint | p50 (ms) | p95 (ms) | p99 (ms) | Throughput (rps) |
|---|---|---|---|---|
| | | | | |
```

#### AuthN / AuthZ Review

```markdown
## AuthN / AuthZ Review

- [ ] New endpoints have appropriate authentication requirements
- [ ] Authorization checks are applied at the correct layer (not only in the UI)
- [ ] No sensitive data is exposed in error responses or logs
```

---

## Type 6: Universal Fallback

**When used:** None of the signals in Steps 1–5 matched.

**Supplemental block:** None. Use the universal base template only. All 9 base sections
are sufficient for projects that do not fit a specialised type.

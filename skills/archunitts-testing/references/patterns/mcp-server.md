# MCP Server Architecture — ArchUnitTS Rule Patterns

**Applies when:** `@modelcontextprotocol/sdk` detected in `package.json` dependencies.

---

## Layer Model

The Model Context Protocol defines primitives and a transport layer:

```
Transport         (stdio adapter, HTTP/SSE adapter)
     │ depends on ▼
Tools             (actions with side-effects — call external services, mutate state)
Resources         (read-only context data — files, DB records, API responses)
Prompts           (reusable prompt templates)
     │ all depend on ▼
Domain / Core     (business logic, independent of MCP SDK)
```

Key invariants:
- **Domain** knows nothing about MCP or transport
- **Resources** are side-effect-free (must not call Tools)
- **Transport** is swappable (stdio ↔ HTTP without changing tools/resources/prompts)
- **MCP SDK** (`@modelcontextprotocol/sdk`) is confined to the transport/adapter layer

---

## Required Rules

### 1. Domain must not depend on MCP SDK

```ts
it('domain must not import the MCP SDK', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .matchingPattern('**/node_modules/@modelcontextprotocol/**');
  await expect(rule).toPassAsync();
});
```

### 2. Domain must not depend on transport layer

```ts
it('domain must not depend on transport layer', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/transport/**');
  await expect(rule).toPassAsync();
});
```

### 3. Resources must not depend on Tools (resources are side-effect-free)

```ts
it('resources must not depend on tools', async () => {
  const rule = projectFiles()
    .inFolder('src/resources/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/tools/**');
  await expect(rule).toPassAsync();
});
```

### 4. MCP SDK confined to transport layer

```ts
it('MCP SDK must only be imported in the transport layer', async () => {
  // Inverse rule: only transport may import SDK
  // Express this as: tools/resources/prompts/domain must not import SDK
  const layers = ['src/tools/**', 'src/resources/**', 'src/prompts/**', 'src/domain/**'];
  for (const layer of layers) {
    const rule = projectFiles()
      .inFolder(layer)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern('**/node_modules/@modelcontextprotocol/**');
    await expect(rule).toPassAsync();
  }
});
```

### 5. No cycles

```ts
it('src has no dependency cycles', async () => {
  const rule = projectFiles()
    .inFolder('src/**')
    .should()
    .haveNoCycles();
  await expect(rule).toPassAsync();
});
```

---

## Recommended Metrics Rules

### Tool handler cohesion — each tool should do one thing

```ts
it('tool handlers should be cohesive', async () => {
  const rule = metrics()
    .inFolder('src/tools/**')
    .lcom()
    .lcom96b()
    .shouldBeBelow(0.5);
  await expect(rule).toPassAsync();
});
```

### Domain should sit on the main sequence

```ts
it('domain layer should balance abstractness and stability', async () => {
  const rule = metrics()
    .inFolder('src/domain/**')
    .distance()
    .distanceFromMainSequence()
    .shouldBeBelow(0.3);
  await expect(rule).toPassAsync();
});
```

---

## PlantUML Diagram Enforcement

> **Note:** ArchUnitTS's `adhereToDiagramInFile()` only supports PlantUML syntax (`@startuml`/`@enduml`). If your architecture docs use Mermaid diagrams, you need to create a separate `.puml` companion file for this rule — or skip it and rely on the layer-boundary rules above instead.

If `docs/architecture/mcp-components.puml` exists, validate slices against it:

```ts
it('MCP components must adhere to architecture diagram', async () => {
  const rule = projectSlices()
    .definedBy('src/(**)/') 
    .should()
    .adhereToDiagramInFile('docs/architecture/mcp-components.puml');
  await expect(rule).toPassAsync();
});
```

Example PlantUML for an MCP server:
```
@startuml
component [domain] as domain
component [tools] as tools
component [resources] as resources
component [prompts] as prompts
component [transport] as transport

tools --> domain
resources --> domain
prompts --> domain
transport --> tools
transport --> resources
transport --> prompts
@enduml
```

---

## Common Folder Name Variants

| Canonical | Common alternatives |
|---|---|
| `domain/` | `core/`, `business/` |
| `tools/` | `handlers/`, `actions/` |
| `resources/` | `data/`, `context/` |
| `prompts/` | `templates/` |
| `transport/` | `adapters/`, `server/`, `mcp/` |

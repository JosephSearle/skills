# Turborepo Boundaries Reference

> Authority: [turborepo.dev/blog/turbo-2-4](https://turborepo.dev/blog/turbo-2-4) and [turborepo.dev/docs](https://turborepo.dev/docs) (v2.x)
>
> **Status: Experimental as of v2.4.** The API may change in future releases. Do not use in production pipelines without pinning the exact turbo version.

`turbo boundaries` enforces package-level access control using tags. It prevents packages from importing other packages they should not have access to — a static analysis check that runs without executing any builds.

---

## Concept

Packages declare one or more `tags` in their `turbo.json`. The root `turbo.json` (or the package itself) declares `boundaries` rules that specify which tags a package is `allowed` or `denied` to import.

This enables patterns like:
- Preventing `apps/web` from importing internal `apps/api` source
- Ensuring `packages/ui` never imports application-layer code
- Isolating experimental packages from stable ones

---

## Configuration

### 1. Tag packages in their `turbo.json`

```jsonc
// packages/ui/turbo.json
{
  "extends": ["//"],
  "tags": ["ui", "shared"]
}
```

```jsonc
// apps/api/turbo.json
{
  "extends": ["//"],
  "tags": ["server", "private"]
}
```

### 2. Declare boundaries rules

Rules can live in the root `turbo.json` or in a package's own `turbo.json`.

```jsonc
// Root turbo.json — global rules
{
  "tasks": { ... },
  "boundaries": {
    "rules": [
      {
        "source": ["ui"],
        "deny": ["server", "private"]
      }
    ]
  }
}
```

```jsonc
// apps/web/turbo.json — package-level rule
{
  "extends": ["//"],
  "boundaries": {
    "rules": [
      {
        "source": ["*"],
        "allow": ["ui", "shared", "config"]
      }
    ]
  }
}
```

### 3. Run the check

```bash
turbo boundaries
```

Reports violations as errors with the importing and imported package names. Does not run any build tasks.

---

## `allow` vs `deny`

| Rule type | Behaviour |
|-----------|-----------|
| `allow` | Only listed tags may be imported; all others are denied |
| `deny` | Listed tags are explicitly forbidden; all others are allowed |

`allow` is more restrictive (allowlist). `deny` is additive on top of defaults (denylist). Use `allow` for packages with strict isolation requirements; use `deny` to block specific anti-patterns.

---

## CI integration

```yaml
# GitHub Actions
- name: Check boundaries
  run: npx turbo boundaries
```

Exits with a non-zero code when violations are found. Add before the build step in CI to catch dependency violations early.

---

## Limitations (experimental)

- Boundaries checks are **static** — they analyse import statements in source files, not runtime behaviour.
- Only TypeScript/JavaScript imports are analysed; dynamic `require()` calls may not be detected.
- The rule schema and tag syntax may change before the feature reaches stable.
- Not yet integrated with `turbo run` — runs as a standalone command only.

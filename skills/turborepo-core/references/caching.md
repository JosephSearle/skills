# Turborepo Caching Reference

> Authority: [turborepo.dev/docs/core-concepts/caching](https://turborepo.dev/docs/core-concepts/caching) and [turborepo.dev/docs/core-concepts/remote-caching](https://turborepo.dev/docs/core-concepts/remote-caching) (v2.x)

---

## How the cache hash is computed

A task's cache key is a hash of:

1. **Input file contents** — all git-tracked files in the package (or the globs in `inputs` if declared)
2. **Resolved `env` and `globalEnv` values** — the actual values of declared env vars, not just their names
3. **`package.json` content** — of the package running the task
4. **Internal dependency versions** — versions of `workspace:*` packages this package depends on

A cache **hit** ("FULL TURBO") replays the task's stdout/stderr logs and restores the `outputs` globs to disk. Nothing is executed.

WRONG — assuming log replay means outputs are restored:
```
# If "outputs" is omitted, a cache hit only replays logs.
# The dist/ directory will not be present on the next run.
```

CORRECT — declare outputs to get file restoration:
```jsonc
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
    }
  }
}
```

---

## Local cache

Stored in `.turbo/` at the workspace root. Persists between runs on the same machine. Clean with `turbo run build --force` (ignores cache, overwrites it) or delete `.turbo/`.

The workspace root is an **implicit dependency of all packages** in v2 — any change to a root file can bust every package's cache. Keep root-level source to a minimum.

---

## Vercel Remote Cache (recommended)

Free on all Vercel plans. Shares the cache across all CI runners and machines.

**Setup (local):**
```bash
npx turbo login      # authenticate with Vercel
npx turbo link       # link repo to Vercel project/team
```

**CI setup:**
```bash
# Set as repository variables (not secrets — team name is not sensitive)
TURBO_TOKEN=<vercel-access-token>   # secret
TURBO_TEAM=<vercel-team-slug>       # variable, not secret
```

CI pipelines automatically use the remote cache when these vars are set.

---

## Self-hosted remote cache

Implements the same public Turborepo cache API. Reference implementation: [ducktors/turborepo-remote-cache](https://github.com/ducktors/turborepo-remote-cache).

Supports S3, GCS, Azure Blob, and local filesystem storage.

```bash
# Configure via env vars
TURBO_API=https://your-cache-server.example.com
TURBO_TOKEN=your-auth-token
TURBO_TEAM=your-team-name
```

`turbo login` and `turbo link` only work with Vercel — for self-hosted, set the env vars manually. No interactive linking step.

---

## Cache-poisoning mitigations

| Risk | Mitigation |
|------|-----------|
| Env var not declared → stale cached output | Strict env mode (v2 default), `eslint-config-turbo` |
| Secret printed to stdout → stored in cache logs | Never `console.log` secrets; treat logs as artifacts |
| Tampered remote cache artifact | `signature: true` in remote cache config + `TURBO_REMOTE_CACHE_SIGNATURE_KEY` env var |
| Undeclared input file changes undetected | Add to `inputs` or rely on default (all tracked files) |

Enable signature verification:
```jsonc
// turbo.json
{
  "remoteCache": {
    "signature": true
  }
}
```

---

## Common cache-miss causes

Work through this checklist when a task isn't caching:

1. **`outputs` not declared** — file caching is disabled; only logs are cached. Add `"outputs": ["dist/**"]`.
2. **Env var not in `env`/`globalEnv`** — var value differs between runs but isn't in the hash. The cache appears to hit but returns wrong outputs. Add to `"env"`.
3. **`.env` file not in `inputs`** — `.env` changes are invisible to the hash. Add `".env"` to `"inputs"`.
4. **Root file changed** — root is an implicit dep of all packages in v2. A change to any root file (tsconfig, eslint config) triggers a global miss.
5. **No remote cache in CI** — CI starts cold on every run. Configure `TURBO_TOKEN` and `TURBO_TEAM`.
6. **`cache: false`** — dev tasks intentionally skip cache. Confirm the task name isn't accidentally marked `cache: false`.
7. **`--force` flag used** — bypasses cache entirely. Remove from scripts.

---

## Debugging cache misses

```bash
# Verbose output showing why a task didn't hit cache
turbo run build --verbosity=2

# Show what inputs contributed to the hash
turbo run build --summarize
# Writes to .turbo/runs/<run-id>.json
```

The run summary JSON shows `inputs`, `envVars`, and the final hash — compare between runs to find what changed.

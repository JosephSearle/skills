# Next.js Standalone Output Reference

> Authority: [nextjs.org/docs/app/api-reference/next-config-js/output](https://nextjs.org/docs/app/api-reference/next-config-js/output)

Standalone output traces the dependencies of each page and copies only the files needed at runtime into `.next/standalone`. This drastically reduces Docker image size.

---

## Configuration

```js
// next.config.js
const nextConfig = {
  output: 'standalone',
}
```

---

## What standalone produces

After `npm run build`:

```
.next/
  standalone/
    server.js           ← entry point (replaces `next start`)
    package.json        ← minimal, only required deps
    node_modules/       ← only traced dependencies (~5–15 MB vs ~300+ MB full)
    .next/
      server/           ← server-side bundles
  static/               ← NOT in standalone — must be copied separately
public/                 ← NOT in standalone — must be copied separately
```

**Critical:** `.next/static` and `public/` are not included in the standalone bundle. They must be copied into the Docker image separately.

WRONG — not copying static assets:
```dockerfile
COPY --from=builder /app/.next/standalone ./
# Result: app runs but CSS, JS, and images return 404
```

CORRECT:
```dockerfile
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
```

---

## Running the standalone server

```bash
node server.js
```

Standalone replaces `next start` entirely. Environment variables that are not embedded at build time (i.e., non-`NEXT_PUBLIC_` variables) must be available at `node server.js` runtime.

---

## Size comparison

| Build mode | `node_modules` in image | Typical image size |
|-----------|------------------------|-------------------|
| Standard (`next start`) | Full (300–500 MB) | 600–800 MB |
| Standalone (`node server.js`) | Traced only (5–15 MB) | 80–150 MB |

---

## NEXT_PUBLIC_ variables and standalone

`NEXT_PUBLIC_` variables are **inlined at build time** — they cannot be changed after the image is built. If the same image must run in staging and production with different API URLs:

WRONG — using `NEXT_PUBLIC_` for environment-specific config:
```
NEXT_PUBLIC_API_URL=https://api.staging.example.com
# This value is baked into the JS bundle at build time
```

CORRECT — use server-side env vars via API routes:
```ts
// Server-only (no NEXT_PUBLIC_ prefix) — set at runtime via OpenShift ConfigMap
const API_URL = process.env.AGENT_BACKEND_URL
```

For values that genuinely must be available in the browser and vary by environment, use a runtime config endpoint:
```ts
// app/api/config/route.ts
export async function GET() {
  return Response.json({
    apiUrl: process.env.PUBLIC_API_URL,  // injected by ConfigMap at pod start
  })
}
```

---

## Development vs. production

Standalone output is for production only. In development, use `next dev` as normal:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "node .next/standalone/server.js"
  }
}
```

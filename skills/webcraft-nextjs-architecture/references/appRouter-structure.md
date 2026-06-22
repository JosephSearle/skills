# App Router Structure Reference

> Authority: [nextjs.org/docs/app](https://nextjs.org/docs/app) and the [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)

Next.js 15 App Router uses file-system routing. Every file in `app/` is a Server Component by default; client components are opt-in with `'use client'`.

---

## Server vs. client decision tree

```
Should this file have 'use client'?
  │
  ├─ Does it import from @carbon/react or @carbon/ibm-products?
  │    └─ YES → 'use client' required
  │
  ├─ Does it use React hooks (useState, useEffect, useRef, etc.)?
  │    └─ YES → 'use client' required
  │
  ├─ Does it use browser APIs (window, document, localStorage, etc.)?
  │    └─ YES → 'use client' required
  │
  ├─ Does it need to handle user events (onClick, onChange, etc.)?
  │    └─ YES → 'use client' required
  │
  └─ Does it only fetch data, render static HTML, or use server-side APIs?
       └─ YES → Server Component (no 'use client', no browser JS shipped)
```

---

## File naming conventions

| File | Role |
|------|------|
| `layout.tsx` | Shared UI that wraps child pages; persists across navigation |
| `page.tsx` | The unique UI for a route; makes the route publicly accessible |
| `loading.tsx` | Automatic Suspense fallback shown while `page.tsx` data loads |
| `error.tsx` | Error boundary for the route segment (must be `'use client'`) |
| `not-found.tsx` | 404 UI for the route segment |
| `route.ts` | API endpoint (replaces `pages/api/`) |

---

## Serialisable props rule

Only serialisable values can cross the server/client boundary as props:

| Allowed | Not allowed |
|---------|------------|
| `string`, `number`, `boolean`, `null`, `undefined` | Functions (callbacks) |
| Plain objects `{}` | Class instances |
| Arrays `[]` | `Date` objects (use ISO string) |
| `Promise` (via `React.use()` in child) | `Map`, `Set` |

WRONG — passing a function from server to client:
```tsx
// app/page.tsx (Server Component)
import { ClientIsland } from './ClientIsland'
async function fetchData() { ... }

export default async function Page() {
  return <ClientIsland onLoad={fetchData} />
  // Error: Functions cannot be passed as props to client components
}
```

CORRECT — pass data, keep function server-side:
```tsx
export default async function Page() {
  const data = await fetchData()
  return <ClientIsland initialData={data} />
}
```

---

## Metadata API

Use the Metadata API in Server Components for SEO (not `<Head>` from older Next.js):

```tsx
// app/(chat)/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Assistant | MyApp',
  description: 'Chat with the AI assistant',
}

export default async function ChatPage() { ... }
```

Dynamic metadata (based on route params):
```tsx
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Session ${params.id}`,
  }
}
```

---

## Environment variables

| Prefix | Available in | Example |
|--------|-------------|---------|
| `NEXT_PUBLIC_` | Browser + server | `NEXT_PUBLIC_APP_NAME` |
| (none) | Server only | `AGENT_BACKEND_URL`, `DATABASE_URL` |

Server-only env vars (no `NEXT_PUBLIC_` prefix) are never sent to the browser. Access them in Server Components, route handlers, and server actions only.

```tsx
// Server Component — safe
const response = await fetch(process.env.AGENT_BACKEND_URL + '/stream')

// Client Component — WRONG: process.env.AGENT_BACKEND_URL is undefined in browser
// Use NEXT_PUBLIC_ prefix or access via API route instead
```

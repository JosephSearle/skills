---
name: webcraft-nextjs-architecture
description: >
  Scaffold and structure a Next.js 15 App Router project for IBM Carbon and LangGraph
  agent backends. Use when starting a new Carbon web project, designing the server/client
  component boundary, setting up Suspense-based streaming for agent responses, or
  organising route groups for chat, dashboard, and general app pages.
  Targets senior developers who know React but need Carbon-specific App Router patterns.
  Triggers on: "scaffold Next.js", "App Router structure", "server components", "streaming UI",
  "project structure Carbon", "Next.js 15 setup", "server shell client island", "route groups",
  "Suspense streaming agent". Not for installing Carbon itself — use webcraft-carbon-setup.
  Not for deployment — use webcraft-openshift-deploy.
---

# webcraft-nextjs-architecture

Next.js 15 App Router is the correct foundation for this stack. The critical architectural constraint is that **IBM Carbon components are client-only** — every component from `@carbon/react` requires a `'use client'` boundary. This pushes you toward a "server shell, client islands" pattern: server components handle data fetching and layout; Carbon UI lives in client islands that receive serialisable props.

---

## Core Philosophy

**Server components fetch; client islands render.** The App Router lets server components access databases, call LangGraph agents, and fetch configuration without shipping any JavaScript to the browser. Carbon components cannot participate in this — they're client-only. The boundary is sharp: a page is a server component that fetches data and passes it down; a `'use client'` island holds all the Carbon UI and interactivity.

**Streaming is the correct pattern for agent responses.** LangGraph backends stream SSE responses. Next.js `<Suspense>` boundaries let you start rendering the shell while agent responses arrive progressively. Do not wait for a complete agent response before rendering — this defeats the purpose of streaming and produces a poor perceived latency UX.

---

## Step 1 — Detect existing structure

```
Check app/ directory:
  └─ Does layout.tsx exist?
       └─ NO → scaffold from scratch (Step 3 — Scaffold)
       └─ YES → identify missing pieces

Check for route groups:
  └─ Do (chat)/, (dashboard)/, or (app)/ route groups exist?
       └─ NO and building multi-section app → add route groups (Step 3 — Route Groups)

Check for client islands:
  └─ Are Carbon components directly in page.tsx files (Server Components)?
       └─ YES → extract to client islands (Step 3 — Client Islands)

Check for Suspense boundaries around agent calls:
  └─ Are async data calls wrapped in <Suspense>?
       └─ NO → add Suspense with loading.tsx or fallback (Step 3 — Streaming)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Scaffolding a new project or setting up directory structure
  │    → load references/appRouter-structure.md
  ├─ Setting up Suspense streaming for agent responses
  │    → load references/streaming-patterns.md
  └─ Organising route groups for chat/dashboard/general pages
       → load references/route-groups.md
```

---

## Step 3 — Execute

### Scaffold: recommended directory structure

```
app/
├── layout.tsx              ← Server Component: HTML shell, metadata, font, providers
├── page.tsx                ← Server Component: home page (redirect to /chat or /dashboard)
├── globals.scss            ← Carbon barrel import
├── providers.tsx           ← 'use client': Theme, QueryClient, Zustand devtools
│
├── (chat)/                 ← Route group: chat UI pages
│   ├── layout.tsx          ← Server: chat shell, nav, session check
│   ├── page.tsx            ← Server: fetch chat history, pass to island
│   └── components/
│       └── ChatIsland.tsx  ← 'use client': Carbon chat UI, streaming
│
├── (dashboard)/            ← Route group: data dashboard pages
│   ├── layout.tsx          ← Server: dashboard shell, date range params
│   ├── page.tsx            ← Server: initial data fetch
│   └── components/
│       └── DashIsland.tsx  ← 'use client': Carbon charts, live polling
│
├── (app)/                  ← Route group: general app pages
│   └── settings/
│       ├── page.tsx
│       └── components/
│           └── SettingsIsland.tsx  ← 'use client': Carbon forms
│
├── api/
│   ├── chat/
│   │   └── route.ts        ← POST: proxy to LangGraph, forward SSE
│   └── health/
│       └── route.ts        ← GET: liveness probe for OpenShift
│
└── components/             ← Shared client islands
    ├── NavIsland.tsx        ← 'use client': Carbon UI Shell / Header
    └── ErrorBoundary.tsx   ← 'use client': Carbon InlineNotification error fallback
```

Route groups (parentheses) are invisible to the URL — `(chat)/page.tsx` maps to `/`, not `/chat`. They share a layout without affecting the URL path.

### Client islands: server/client boundary pattern

```tsx
// app/(chat)/page.tsx — Server Component
import { ChatIsland } from './components/ChatIsland'
import { fetchChatHistory } from '@/lib/api'

export default async function ChatPage() {
  const history = await fetchChatHistory()  // server-side, no client JS
  return <ChatIsland initialHistory={history} />
}
```

```tsx
// app/(chat)/components/ChatIsland.tsx — Client Island
'use client'
import { useChat } from 'ai/react'
import { TextInput, Button, Layer } from '@carbon/react'

interface Props {
  initialHistory: Message[]
}

export function ChatIsland({ initialHistory }: Props) {
  const { messages, input, handleSubmit, handleInputChange, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: initialHistory,
  })
  // ... Carbon UI
}
```

Only serialisable props (strings, numbers, plain objects, arrays) can cross the server/client boundary. Functions, class instances, and non-serialisable objects cannot be passed as props.

### TypeScript configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`"moduleResolution": "Bundler"` is required for Next.js 15 + TypeScript 5 — the older `"Node16"` mode causes false errors with Carbon's ESM exports.

### Providers wrapper

```tsx
// app/providers.tsx
'use client'
import { Theme } from '@carbon/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <Theme theme="g100">
        {children}
      </Theme>
    </QueryClientProvider>
  )
}
```

### Streaming patterns

See `references/streaming-patterns.md` for Suspense boundaries and `loading.tsx` conventions.

---

## Step 4 — Validate

- [ ] `layout.tsx` is a Server Component (no `'use client'` at root)
- [ ] `globals.scss` is imported in root `layout.tsx`
- [ ] `providers.tsx` has `'use client'` and wraps `<Theme>`
- [ ] All Carbon component files have `'use client'`
- [ ] Server Components only pass serialisable props to client islands
- [ ] Route groups are named with parentheses and match the app's sections
- [ ] `/api/health/route.ts` exists (required for OpenShift liveness probes)
- [ ] `tsconfig.json` uses `"moduleResolution": "Bundler"`
- [ ] `tsconfig.json` has `"strict": true`
- [ ] Agent calls wrapped in `<Suspense>` with a loading fallback

---

## Reference Files

- [references/appRouter-structure.md](references/appRouter-structure.md) — Full directory scaffold, server/client decision tree, serialisable props rules, metadata API. **Load for new project setup or restructuring.**
- [references/streaming-patterns.md](references/streaming-patterns.md) — `<Suspense>` boundaries, `loading.tsx` conventions, SSE proxy route handler, streaming agent responses. **Load when setting up agent streaming.**
- [references/route-groups.md](references/route-groups.md) — Route group patterns for chat/dashboard/general pages, shared layouts, parallel routes. **Load when organising multi-section apps.**

---

## Source Documentation

All content is grounded in [nextjs.org/docs/app](https://nextjs.org/docs/app), the [Next.js 15 release notes](https://nextjs.org/blog/next-15), the [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md), and [nextjs.org/docs/app/building-your-application/configuring/typescript](https://nextjs.org/docs/app/building-your-application/configuring/typescript).

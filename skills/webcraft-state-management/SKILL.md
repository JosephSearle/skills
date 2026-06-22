---
name: webcraft-state-management
description: >
  Set up client and server state management for Carbon Next.js apps. Covers Zustand
  for client/UI state (chat streaming, sidebar, active session) and TanStack Query v5
  for server/async state (dashboard metrics, API data, SSR prefetching). Requires
  webcraft-nextjs-architecture for the App Router context.
  Triggers on: "state management", "Zustand", "TanStack Query", "global state",
  "client state Next.js", "chat streaming state", "server state caching", "appendChunk",
  "HydrationBoundary", "store setup". Not for form state — use webcraft-forms-validation.
  Not for OTel spans — use webcraft-otel-frontend.
---

# webcraft-state-management

State in a Carbon Next.js app splits cleanly into two categories with different solutions. **Client/UI state** (chat message history, streaming status, sidebar open/closed, active theme) belongs in **Zustand** — zero boilerplate, no provider required, works naturally with the App Router. **Server/async state** (dashboard metrics, API data, pagination, cache invalidation) belongs in **TanStack Query v5** — automatic background refetching, deduplication, and SSR hydration via `HydrationBoundary`.

---

## Core Philosophy

**Zustand needs no provider.** Unlike Redux or Context, Zustand stores are module-level singletons. You import the hook and use it — no `<StoreProvider>` wrapper required. This is important for Carbon apps where the `<Theme>`, `<QueryClientProvider>`, and other providers already nest. Adding another provider for every piece of state compounds the wrapper problem.

**Never put server state in Zustand.** A Zustand store that fetches data, manages loading/error state, and handles refetching is re-implementing TanStack Query badly. Store chat messages and UI state in Zustand; store API responses in TanStack Query. The boundary is: does this data come from a server? If yes, TanStack Query.

---

## Step 1 — Detect existing setup

```
Check package.json:
  └─ Is zustand installed?
       └─ NO → install it (Step 3 — Zustand)

  └─ Is @tanstack/react-query installed?
       └─ NO → install it (Step 3 — TanStack Query)

Check app/providers.tsx:
  └─ Is <QueryClientProvider> present?
       └─ NO → add it (Step 3 — TanStack Query)

Check stores/ directory:
  └─ No store files? → create chatStore.ts (Step 3 — Zustand)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Setting up Zustand stores or debugging store state
  │    → load references/zustand-patterns.md
  └─ Setting up TanStack Query or SSR prefetching
       → load references/tanstack-query-setup.md
```

---

## Step 3 — Execute

### Install

```bash
npm install zustand @tanstack/react-query
npm install --save-dev @tanstack/react-query-devtools
```

### TanStack Query provider

```tsx
// app/providers.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Theme } from '@carbon/react'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 2,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <Theme theme="g100">
        {children}
      </Theme>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### Chat Zustand store

```ts
// stores/chatStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

interface ChatStore {
  messages: Message[]
  isStreaming: boolean
  activeSessionId: string | null
  addMessage: (msg: Message) => void
  appendChunk: (chunk: string) => void
  setStreaming: (val: boolean) => void
  setSession: (id: string | null) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>()(
  devtools(
    (set) => ({
      messages: [],
      isStreaming: false,
      activeSessionId: null,
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      appendChunk: (chunk) =>
        set((s) => ({
          messages: s.messages.map((m, i) =>
            i === s.messages.length - 1
              ? { ...m, content: m.content + chunk }
              : m
          ),
        })),
      setStreaming: (val) => set({ isStreaming: val }),
      setSession: (id) => set({ activeSessionId: id }),
      clearMessages: () => set({ messages: [] }),
    }),
    { name: 'ChatStore' }
  )
)
```

### UI state Zustand store

```ts
// stores/uiStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  sidebarOpen: boolean
  theme: 'white' | 'g10' | 'g90' | 'g100'
  toggleSidebar: () => void
  setTheme: (theme: UIStore['theme']) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'g100',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'ui-preferences' }
  )
)
```

The `persist` middleware saves `sidebarOpen` and `theme` to `localStorage` — user preferences survive page refreshes.

---

## Step 4 — Validate

- [ ] `zustand` and `@tanstack/react-query` in `package.json` dependencies
- [ ] `<QueryClientProvider>` wraps the app in `app/providers.tsx`
- [ ] `<ReactQueryDevtools>` added (dev experience, no production impact)
- [ ] Zustand stores use `devtools()` middleware for Redux DevTools support
- [ ] Chat store has `appendChunk` for streaming text accumulation
- [ ] UI preferences store uses `persist()` middleware for localStorage
- [ ] No `useEffect` + `useState` patterns for data fetching — use TanStack Query instead
- [ ] No `fetch()` calls inside Zustand actions for server data — use TanStack Query instead
- [ ] Store names in `devtools({ name: '...' })` match their file name for DevTools clarity

---

## Reference Files

- [references/zustand-patterns.md](references/zustand-patterns.md) — Store setup, devtools middleware, persist middleware, `appendChunk` streaming pattern, store composition. **Load for Zustand setup or store design.**
- [references/tanstack-query-setup.md](references/tanstack-query-setup.md) — QueryClient config, `HydrationBoundary` SSR pattern, `refetchInterval` polling, optimistic updates. **Load for TanStack Query setup or SSR prefetching.**

---

## Source Documentation

All content is grounded in [github.com/pmndrs/zustand](https://github.com/pmndrs/zustand), [tanstack.com/query/latest](https://tanstack.com/query/latest), and [tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr).

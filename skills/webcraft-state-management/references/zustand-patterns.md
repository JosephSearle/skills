# Zustand Patterns Reference

> Authority: [github.com/pmndrs/zustand](https://github.com/pmndrs/zustand) (47k stars, de facto React client state standard)

Zustand stores are plain JavaScript modules. A store is a single `create()` call — no actions, reducers, or selectors boilerplate.

---

## Minimal store

```ts
import { create } from 'zustand'

interface CounterStore {
  count: number
  increment: () => void
  reset: () => void
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set({ count: 0 }),
}))
```

Usage in a component:
```tsx
'use client'
import { useCounterStore } from '@/stores/counterStore'

function Counter() {
  const { count, increment } = useCounterStore()
  return <button onClick={increment}>{count}</button>
}
```

---

## DevTools middleware

Wrap every production store with `devtools()` for Redux DevTools support:

```ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useMyStore = create<MyStore>()(
  devtools(
    (set) => ({ /* state and actions */ }),
    { name: 'MyStore' }
  )
)
```

The `name` appears in the Redux DevTools extension — use the store file name for clarity.

---

## Persist middleware

Persist state to `localStorage` for user preferences:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'g100' as const,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme: string) => set({ theme }),
    }),
    {
      name: 'ui-preferences',  // localStorage key
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        // omit action functions — they aren't serialisable
      }),
    }
  )
)
```

---

## Combining devtools + persist

```ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({ /* state */ }),
      { name: 'ui-preferences' }
    ),
    { name: 'UIStore' }
  )
)
```

Middleware order: `devtools` wraps `persist` — this ensures DevTools sees the persisted state correctly.

---

## Selecting from a store (preventing re-renders)

Select only the state slice you need to avoid unnecessary re-renders:

WRONG — subscribing to the whole store:
```tsx
const store = useChatStore()  // re-renders on any store change
```

CORRECT — select only what you need:
```tsx
const messages = useChatStore((s) => s.messages)
const isStreaming = useChatStore((s) => s.isStreaming)
```

---

## Accessing store outside React

Read or update store state from non-component code (e.g., in a fetch utility):

```ts
// From anywhere — no hook required
const { setStreaming, appendChunk } = useChatStore.getState()
setStreaming(true)
appendChunk('Hello')
```

---

## Store file conventions

```
stores/
  chatStore.ts    ← chat messages, streaming, active session
  uiStore.ts      ← sidebar, theme, drawer open/close
```

- One store per domain concern
- Export the hook as default named export: `export const useChatStore`
- Keep actions co-located with state (not in separate action files)
- Use TypeScript interfaces for all store state and actions

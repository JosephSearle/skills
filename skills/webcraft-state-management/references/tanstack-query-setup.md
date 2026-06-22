# TanStack Query Setup Reference

> Authority: [tanstack.com/query/latest](https://tanstack.com/query/latest) and [tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)

TanStack Query v5 manages server/async state: fetching, caching, background refetching, and SSR hydration.

---

## QueryClient configuration

```ts
// Recommended defaults for an AI dashboard app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // data is fresh for 60 seconds
      gcTime: 5 * 60_000,       // unused cache entries removed after 5 minutes
      retry: 2,                  // retry failed queries twice
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,                  // don't retry mutations
    },
  },
})
```

In `app/providers.tsx`, use `useState` to create the client so it's stable across re-renders:

```tsx
const [queryClient] = useState(() => new QueryClient({ /* config */ }))
```

---

## Basic useQuery

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'

function MetricsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-metrics', { period: '7d' }],
    queryFn: () => fetch('/api/metrics?period=7d').then((r) => {
      if (!r.ok) throw new Error('Metrics fetch failed')
      return r.json()
    }),
    refetchInterval: 30_000,
  })

  if (isLoading) return <InlineLoading description="Loading metrics..." />
  if (error) return <InlineNotification kind="error" title={error.message} />
  return <MetricsChart data={data} />
}
```

---

## Query key conventions

```ts
// Hierarchical keys — invalidate by prefix
['metrics']                          // all metrics
['metrics', { period: '7d' }]        // specific period
['agents', agentId]                  // specific agent
['agents', agentId, 'sessions']      // agent's sessions
```

Invalidate all metrics queries:
```ts
queryClient.invalidateQueries({ queryKey: ['metrics'] })
```

---

## HydrationBoundary — SSR prefetching

Prefetch on the server to eliminate loading state on first render:

```tsx
// app/(dashboard)/dashboard/page.tsx — Server Component
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

export default async function DashboardPage() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['agent-metrics', { period: '7d' }],
    queryFn: () =>
      fetch(`${process.env.INTERNAL_API_URL}/metrics?period=7d`).then((r) => r.json()),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashIsland />
    </HydrationBoundary>
  )
}
```

The client `DashIsland` finds the data already in its cache — no loading flash. The `refetchInterval` then keeps data fresh.

---

## Optimistic updates for chat interactions

```tsx
const queryClient = useQueryClient()

const rateMessage = useMutation({
  mutationFn: (rating: { messageId: string; value: 1 | -1 }) =>
    fetch('/api/rate', { method: 'POST', body: JSON.stringify(rating) }),

  onMutate: async (rating) => {
    // Cancel any in-flight refetches
    await queryClient.cancelQueries({ queryKey: ['messages'] })

    // Snapshot previous value
    const previous = queryClient.getQueryData(['messages'])

    // Optimistically update
    queryClient.setQueryData(['messages'], (old: Message[]) =>
      old.map((m) => m.id === rating.messageId ? { ...m, rating: rating.value } : m)
    )

    return { previous }
  },

  onError: (_err, _vars, context) => {
    // Rollback on error
    queryClient.setQueryData(['messages'], context?.previous)
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['messages'] })
  },
})
```

---

## Background refetch for live dashboards

```ts
useQuery({
  queryKey: ['dashboard-metrics'],
  queryFn: fetchMetrics,
  refetchInterval: 30_000,             // poll every 30 seconds
  refetchIntervalInBackground: true,   // keep polling when tab is not focused
})
```

`refetchIntervalInBackground: true` ensures the dashboard stays current even if the user switches tabs — important for NOC-style operational dashboards.

---

## useSuspenseQuery — streaming with Suspense

Use `useSuspenseQuery` to integrate with React `<Suspense>` for progressive loading:

```tsx
// In a Client Component with a Suspense boundary above it
import { useSuspenseQuery } from '@tanstack/react-query'

function AgentStats({ agentId }: { agentId: string }) {
  // Suspends until data is available — no isLoading needed
  const { data } = useSuspenseQuery({
    queryKey: ['agents', agentId, 'stats'],
    queryFn: () => fetchAgentStats(agentId),
  })
  return <StatsDisplay stats={data} />
}
```

The parent server component wraps with `<Suspense fallback={<InlineLoading />}>`.

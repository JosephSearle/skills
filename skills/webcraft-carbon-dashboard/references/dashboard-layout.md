# Dashboard Layout Reference

> Authority: [carbondesignsystem.com/components/grid/usage](https://carbondesignsystem.com/components/grid/usage) and [tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)

Carbon Grid, Column, and Tile form the layout foundation for dashboards. TanStack Query provides live data with automatic polling.

---

## Carbon Grid system

Carbon uses a 16-column grid. Column spans must sum correctly per breakpoint:

| Breakpoint prefix | Screen width | Columns available |
|------------------|-------------|------------------|
| `sm` | < 672px | 4 |
| `md` | 672–1056px | 8 |
| `lg` | 1056–1312px | 16 |
| `xlg` | 1312–1584px | 16 |
| `max` | > 1584px | 16 |

```tsx
import { Grid, Column, Tile } from '@carbon/react'

<Grid>
  {/* Full width row */}
  <Column lg={16} md={8} sm={4}>
    <Tile><ThroughputChart /></Tile>
  </Column>

  {/* Two-column row */}
  <Column lg={8} md={4} sm={4}>
    <Tile><LatencyGauge /></Tile>
  </Column>
  <Column lg={8} md={4} sm={4}>
    <Tile><ErrorRateDonut /></Tile>
  </Column>

  {/* Three-column row */}
  <Column lg={5} md={3} sm={4}>
    <Tile><StatCard label="Total Requests" value={total} /></Tile>
  </Column>
  <Column lg={5} md={3} sm={4}>
    <Tile><StatCard label="Avg Tokens" value={avgTokens} /></Tile>
  </Column>
  <Column lg={6} md={2} sm={4}>
    <Tile><StatCard label="Active Sessions" value={sessions} /></Tile>
  </Column>
</Grid>
```

---

## Tile variants

| Variant | When to use |
|---------|------------|
| `<Tile>` | Static content, chart containers |
| `<ClickableTile>` | Drilldown navigation (click to filter) |
| `<ExpandableTile>` | Secondary details that collapse |

```tsx
// Clickable tile — drill into agent detail
<ClickableTile
  href={`/dashboard/agents/${agentId}`}
  className="agent-summary-tile"
>
  <p className="tile-label">Agent: {agentName}</p>
  <p className="tile-value">{latency}ms</p>
</ClickableTile>
```

---

## TanStack Query for live dashboard data

Install (if not already part of webcraft-state-management setup):

```bash
npm install @tanstack/react-query
```

Provider setup in `app/providers.tsx`:
```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
    },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Live polling in a dashboard component:

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'

export function DashIsland() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/metrics')
      if (!res.ok) throw new Error('Failed to fetch metrics')
      return res.json()
    },
    refetchInterval: 30_000,      // refetch every 30 seconds
    refetchIntervalInBackground: true,
  })

  return (
    <div>
      {isLoading && <InlineLoading description="Loading metrics..." />}
      {error && <InlineNotification kind="error" title={error.message} />}
      {data && (
        <>
          <LatencyGauge latencyMs={data.p50LatencyMs} />
          <ThroughputChart data={data.throughput} />
        </>
      )}
      {data && (
        <p className="last-updated">
          Updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
```

---

## Server-side prefetching with HydrationBoundary

Prefetch dashboard data on the server to avoid loading flash:

```tsx
// app/(dashboard)/dashboard/page.tsx — Server Component
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { DashIsland } from './components/DashIsland'

export default async function DashboardPage() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => fetch(`${process.env.INTERNAL_API_URL}/metrics`).then(r => r.json()),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashIsland />
    </HydrationBoundary>
  )
}
```

The client `DashIsland` receives pre-hydrated data from the server — no loading state on first render. Subsequent `refetchInterval` polls keep the data fresh.

---

## Dashboard page SCSS

```scss
@use '@carbon/react/scss/spacing' as spacing;

.dashboard-page {
  padding: spacing.$spacing-07 spacing.$spacing-06;
}

.last-updated {
  color: var(--cds-text-secondary);
  font-size: 0.75rem;
  text-align: right;
  margin-top: spacing.$spacing-03;
}
```

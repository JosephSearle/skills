---
name: webcraft-carbon-dashboard
description: >
  Build data dashboards using @carbon/charts-react and Carbon layout components.
  Covers chart type selection for AI operational metrics, Grid/Column/Tile layout,
  TanStack Query for live data, and D3 for custom visualisations not covered by
  Carbon Charts. Requires webcraft-carbon-setup and webcraft-nextjs-architecture.
  Triggers on: "build dashboard", "Carbon charts", "data viz", "metrics page",
  "agent metrics dashboard", "@carbon/charts-react", "latency chart", "throughput chart",
  "token usage chart", "Gauge Carbon", "live dashboard data". Not for general
  state management — use webcraft-state-management for TanStack Query provider setup.
---

# webcraft-carbon-dashboard

`@carbon/charts-react` is the official IBM Carbon charting library — 20+ chart types, all pre-styled with Carbon's visual language, color palettes, and dark/light theme support. For AI operational dashboards, the key charts are **Gauge** (latency, token usage thresholds), **Line** (throughput over time), **Bar** (per-agent or per-tool comparisons), and **Alluvial/Sankey** (agent trace flows). D3 fills gaps for custom visualisations.

---

## Core Philosophy

**Always import `styles.css`.** `@carbon/charts-react` requires an explicit CSS import — it does not inject styles automatically. Missing this import produces unstyled or broken charts with no build error. Put the import once in `globals.scss` or in the chart component file.

**Match chart theme to Carbon theme.** Every chart component accepts a `theme` option. Set it to `'g100'` for dark mode, `'white'` for light. Mismatching themes produces charts that visually clash with the surrounding Carbon UI.

---

## Step 1 — Detect existing setup

```
Check package.json:
  └─ Is @carbon/charts-react installed?
       └─ NO → install it (Step 3 — Install)

Check globals.scss or chart component file:
  └─ Is @carbon/charts-react/styles.css imported?
       └─ NO → add import (Step 3 — Install)

Check dashboard layout:
  └─ Is Carbon Grid/Column/Tile used for the grid?
       └─ NO → use Carbon layout (Step 3 — Layout)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Installing Carbon Charts or fixing unstyled charts
  │    → load references/carbon-charts-setup.md
  ├─ Choosing the right chart type for a specific AI metric
  │    → load references/chart-type-selection.md
  └─ Building the dashboard layout or wiring live data
       → load references/dashboard-layout.md
```

---

## Step 3 — Execute

### Install

```bash
npm install @carbon/charts-react @carbon/charts
```

Add the required CSS import to `app/globals.scss`:

```scss
@use '@carbon/react';
@carbon/charts-react/styles.css  /* required — charts won't style without this */
```

Or import in the chart island file:

```tsx
'use client'
import '@carbon/charts-react/styles.css'
import { LineChart } from '@carbon/charts-react'
```

### Agent latency gauge

```tsx
'use client'
import '@carbon/charts-react/styles.css'
import { GaugeChart } from '@carbon/charts-react'

export function LatencyGauge({ latencyMs }: { latencyMs: number }) {
  return (
    <GaugeChart
      data={[
        { group: 'value', value: latencyMs },
        { group: 'delta', value: 0 },
      ]}
      options={{
        title: 'P50 Agent Latency',
        gauge: {
          type: 'semi',
          status: latencyMs < 3000 ? 'success' : latencyMs < 8000 ? 'warning' : 'danger',
        },
        height: '200px',
        theme: 'g100',
      }}
    />
  )
}
```

### Throughput line chart

```tsx
'use client'
import { LineChart } from '@carbon/charts-react'

interface DataPoint {
  date: Date
  value: number
  group: string
}

export function ThroughputChart({ data }: { data: DataPoint[] }) {
  return (
    <LineChart
      data={data}
      options={{
        title: 'Agent Requests / Min',
        axes: {
          bottom: { title: 'Time', mapsTo: 'date', scaleType: 'time' },
          left: { title: 'Requests/min', mapsTo: 'value', scaleType: 'linear' },
        },
        curve: 'curveMonotoneX',
        height: '300px',
        theme: 'g100',
      }}
    />
  )
}
```

### Dashboard grid layout

```tsx
// app/(dashboard)/dashboard/components/DashIsland.tsx
'use client'
import { Grid, Column, Tile } from '@carbon/react'
import { LatencyGauge } from './LatencyGauge'
import { ThroughputChart } from './ThroughputChart'
import { TokenUsageBar } from './TokenUsageBar'
import { useQuery } from '@tanstack/react-query'

export function DashIsland() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => fetch('/api/metrics').then((r) => r.json()),
    refetchInterval: 30_000,
  })

  return (
    <Grid>
      <Column lg={4} md={4} sm={4}>
        <Tile>
          <LatencyGauge latencyMs={data?.p50LatencyMs ?? 0} />
        </Tile>
      </Column>
      <Column lg={8} md={4} sm={4}>
        <Tile>
          <ThroughputChart data={data?.throughput ?? []} />
        </Tile>
      </Column>
      <Column lg={16} md={8} sm={4}>
        <Tile>
          <TokenUsageBar data={data?.tokenUsage ?? []} />
        </Tile>
      </Column>
    </Grid>
  )
}
```

---

## Step 4 — Validate

- [ ] `@carbon/charts-react` and `@carbon/charts` in `package.json` dependencies
- [ ] `@carbon/charts-react/styles.css` imported (in `globals.scss` or chart files)
- [ ] Every chart component has `'use client'` (Carbon Charts uses browser APIs)
- [ ] Every chart `options` object has `theme: 'g100'` (or `'white'` for light mode)
- [ ] Dashboard layout uses Carbon `Grid`, `Column`, `Tile` — not custom CSS grids
- [ ] Column spans follow Carbon's 16-column grid (total per row must sum to 16 on lg)
- [ ] Live data uses `refetchInterval` in TanStack Query, not `setInterval`
- [ ] Charts render correctly with empty `data: []` (no blank screen or crash)

---

## Reference Files

- [references/carbon-charts-setup.md](references/carbon-charts-setup.md) — Installation, `styles.css` requirement, theme config, available chart types. **Load for all chart setup tasks.**
- [references/chart-type-selection.md](references/chart-type-selection.md) — Decision table: which chart for which AI metric (latency→Gauge, throughput→Line, token usage→Bar, trace flows→Alluvial). **Load when choosing chart types.**
- [references/dashboard-layout.md](references/dashboard-layout.md) — Carbon `Grid`/`Column`/`Tile` layout, TanStack Query live data, D3 integration for custom charts. **Load for layout and live data wiring.**

---

## Source Documentation

All content is grounded in [charts.carbondesignsystem.com](https://charts.carbondesignsystem.com/), [github.com/carbon-design-system/carbon-charts](https://github.com/carbon-design-system/carbon-charts), [tanstack.com/query/latest](https://tanstack.com/query/latest), and [d3js.org](https://d3js.org/).

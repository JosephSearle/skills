# @carbon/charts-react Setup Reference

> Authority: [charts.carbondesignsystem.com](https://charts.carbondesignsystem.com/) and [github.com/carbon-design-system/carbon-charts](https://github.com/carbon-design-system/carbon-charts)

`@carbon/charts-react` wraps D3-based chart implementations in React components pre-styled with Carbon's visual language.

---

## Installation

```bash
npm install @carbon/charts-react @carbon/charts
```

`@carbon/charts` is the core library; `@carbon/charts-react` is the React wrapper. Both must be installed.

---

## Required CSS import

WRONG — missing styles import:
```tsx
'use client'
import { LineChart } from '@carbon/charts-react'
// Charts render but look completely unstyled — no error thrown
```

CORRECT — import styles:
```tsx
'use client'
import '@carbon/charts-react/styles.css'
import { LineChart } from '@carbon/charts-react'
```

Or add to `globals.scss` (applies globally, avoids per-file imports):
```scss
@use '@carbon/react';
@import '@carbon/charts-react/styles.css';
```

---

## Available chart types

| Component | Category | Best for |
|-----------|----------|---------|
| `LineChart` | Time series | Throughput, latency trends |
| `AreaChart` | Time series | Cumulative metrics |
| `StackedAreaChart` | Time series | Multi-agent breakdowns |
| `BarChart` | Comparison | Per-model token usage |
| `GroupedBarChart` | Comparison | Side-by-side model comparison |
| `StackedBarChart` | Comparison | Stacked token categories |
| `GaugeChart` | Single value | P50/P95 latency, SLO status |
| `MeterChart` | Progress | Budget consumption |
| `PieChart` | Proportion | Error type breakdown |
| `DonutChart` | Proportion | Proportion with center label |
| `ScatterChart` | Correlation | Latency vs token count |
| `BubbleChart` | Correlation | 3-variable comparisons |
| `HeatmapChart` | Matrix | Hourly request heatmap |
| `AlluvialChart` | Flow | Agent→tool→result flows |

---

## Base chart options structure

```ts
import type { ChartTabularData, LineChartOptions } from '@carbon/charts-react'

const data: ChartTabularData = [
  { group: 'Agent A', date: new Date('2025-01-01'), value: 1200 },
  { group: 'Agent B', date: new Date('2025-01-01'), value: 980 },
]

const options: LineChartOptions = {
  title: 'Response Latency',
  axes: {
    bottom: { title: 'Date', mapsTo: 'date', scaleType: 'time' },
    left: { title: 'Latency (ms)', mapsTo: 'value', scaleType: 'linear' },
  },
  color: {
    scale: {
      'Agent A': '#0f62fe',  // Carbon blue-60
      'Agent B': '#6fdc8c',  // Carbon green-30
    },
  },
  height: '300px',
  theme: 'g100',   // must match Carbon theme
}
```

---

## Theme alignment

Charts must match the surrounding Carbon theme:

```tsx
// Get theme from Zustand store or context
const { theme } = useThemeStore()

<LineChart
  data={data}
  options={{
    ...options,
    theme: theme === 'dark' ? 'g100' : 'white',
  }}
/>
```

| Carbon theme | Chart theme value |
|-------------|------------------|
| `'white'` | `'white'` |
| `'g10'` | `'white'` |
| `'g90'` | `'g90'` |
| `'g100'` | `'g100'` |

---

## Handling empty data

Charts should render gracefully when `data` is an empty array:

```tsx
if (!data || data.length === 0) {
  return (
    <Tile>
      <p>No data available</p>
    </Tile>
  )
}
return <LineChart data={data} options={options} />
```

Carbon Charts does not crash on empty data, but it renders an empty canvas — provide an explicit empty state for better UX.

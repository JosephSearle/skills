# Chart Type Selection Reference

> Authority: [charts.carbondesignsystem.com](https://charts.carbondesignsystem.com/) (chart type usage guidance)

Decision table for selecting the right Carbon chart type for AI operational metrics.

---

## AI metric → chart type mapping

| Metric | Chart type | Reasoning |
|--------|-----------|-----------|
| P50/P95 latency (single value vs threshold) | `GaugeChart` | Shows current value relative to SLO threshold |
| Latency trend over time | `LineChart` | Time-series with multiple agent groups |
| Requests per minute / throughput | `LineChart` or `AreaChart` | Continuous time-series |
| Token usage per request | `BarChart` | Discrete counts, compare across models |
| Token budget consumption | `MeterChart` | Progress toward a budget cap |
| Error rate breakdown by type | `DonutChart` | Proportions with category labels |
| Multi-agent throughput comparison | `GroupedBarChart` | Side-by-side per-agent bars |
| Agent tool call flows | `AlluvialChart` | Directed flow: agent → tool → result |
| Hourly request volume heatmap | `HeatmapChart` | 2D matrix: hour × day |
| Cost vs latency correlation | `ScatterChart` | Shows trade-off relationship |

---

## GaugeChart for SLO monitoring

```tsx
<GaugeChart
  data={[
    { group: 'value', value: p95Latency },
    { group: 'delta', value: 0 },
  ]}
  options={{
    gauge: {
      type: 'semi',
      arcWidth: 16,
      status: p95Latency < 3000 ? 'success' : p95Latency < 8000 ? 'warning' : 'danger',
    },
    title: 'P95 Latency (ms)',
    height: '180px',
    theme: 'g100',
  }}
/>
```

The `status` field maps to Carbon's semantic colors: `'success'` (green), `'warning'` (yellow), `'danger'` (red).

---

## AlluvialChart for agent trace flows

Alluvial (Sankey) charts show directed flows between categories — ideal for visualising which agents call which tools and with what frequency:

```tsx
const traceData = [
  { source: 'chat-agent', target: 'search-tool', value: 142 },
  { source: 'chat-agent', target: 'calc-tool', value: 38 },
  { source: 'billing-agent', target: 'db-tool', value: 204 },
]

<AlluvialChart
  data={traceData}
  options={{
    title: 'Agent → Tool Calls (7 days)',
    alluvial: {
      nodes: [
        { name: 'chat-agent' },
        { name: 'billing-agent' },
        { name: 'search-tool' },
        { name: 'calc-tool' },
        { name: 'db-tool' },
      ],
    },
    height: '400px',
    theme: 'g100',
  }}
/>
```

---

## HeatmapChart for request volume patterns

```tsx
const heatmapData = hours.flatMap((hour) =>
  days.map((day) => ({
    hour: String(hour),
    day,
    value: requestCounts[day][hour],
  }))
)

<HeatmapChart
  data={heatmapData}
  options={{
    title: 'Requests by Hour and Day',
    axes: {
      bottom: { title: 'Hour', mapsTo: 'hour' },
      left: { title: 'Day', mapsTo: 'day' },
    },
    heatmap: { colorLegend: { title: 'Requests' } },
    height: '300px',
    theme: 'g100',
  }}
/>
```

---

## When Carbon Charts is insufficient: D3 supplementation

Carbon Charts covers the most common chart types. Use raw D3 for:

| Requirement | Reason Carbon Charts falls short |
|-------------|----------------------------------|
| Agent dependency graph (force-directed) | No force-directed layout in Carbon Charts |
| Custom interactive timeline | Complex interaction model Carbon Charts doesn't support |
| Specialised trace waterfall | Multi-lane Gantt-style charts not available |

D3 integration pattern with React:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export function AgentDependencyGraph({ nodes, links }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(400, 300))

    // ... D3 rendering
  }, [nodes, links])

  return <svg ref={svgRef} width={800} height={600} />
}
```

Install D3: `npm install d3 @types/d3`

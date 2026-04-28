"use client"

import { EChartWrapper } from "./EChartWrapper"

interface ScatterPoint {
  id: string
  hardwareSlug: string
  fpsAvg: number
  fpsOnePercentLow: number
  stabilityRatio: number
}

export function StabilityScatterChart({ data, deviceNames }: { data: ScatterPoint[]; deviceNames?: Record<string, string> }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-text/40">No stability data yet</div>
  }

  // Group by device
  const deviceGroups = new Map<string, ScatterPoint[]>()
  for (const point of data) {
    const existing = deviceGroups.get(point.hardwareSlug) || []
    existing.push(point)
    deviceGroups.set(point.hardwareSlug, existing)
  }

  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
  const series = Array.from(deviceGroups.entries()).map(([slug, points], idx) => ({
    name: deviceNames?.[slug] || slug,
    type: "scatter" as const,
    data: points.map((p) => [p.fpsAvg, p.fpsOnePercentLow]),
    itemStyle: { color: colors[idx % colors.length] },
    symbolSize: 8,
  }))

  // Perfect stability line (y = x)
  const maxFps = Math.max(...data.map((d) => d.fpsAvg))
  const perfectLine = {
    name: "Perfect Stability",
    type: "line" as const,
    data: [
      [0, 0],
      [maxFps, maxFps],
    ],
    lineStyle: { color: "#555", type: "dashed" as const },
    symbol: "none",
    silent: true,
  }

  const option = {
    tooltip: {
      trigger: "item" as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        if (params.seriesName === "Perfect Stability") return ""
        return `${params.seriesName}<br/>Avg: ${params.value[0]} fps<br/>1% Low: ${params.value[1]} fps`
      },
    },
    legend: {
      textStyle: { color: "#999" },
      top: 0,
    },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "value" as const,
      name: "Avg FPS",
      nameTextStyle: { color: "#999" },
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#999" },
    },
    yAxis: {
      type: "value" as const,
      name: "1% Low FPS",
      nameTextStyle: { color: "#999" },
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#999" },
    },
    series: [...series, perfectLine],
  }

  return <EChartWrapper option={option} height={300} />
}

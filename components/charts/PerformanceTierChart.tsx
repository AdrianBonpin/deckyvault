"use client"

import { EChartWrapper } from "./EChartWrapper"

interface TierData {
  hardwareSlug: string
  hardwareName?: string
  unplayable: number
  playable: number
  smooth: number
  excellent: number
}

export function PerformanceTierChart({ data }: { data: TierData[] }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-text/40">No tier data</div>
  }

  const labels = data.map((d) => d.hardwareName || d.hardwareSlug)

  const option = {
    tooltip: {
      trigger: "axis" as const,
      axisPointer: { type: "shadow" as const },
    },
    legend: {
      data: ["<30 fps", "30-59", "60-119", "≥120"],
      textStyle: { color: "#999" },
      top: 0,
    },
    grid: { left: 100, right: 20, top: 40, bottom: 30 },
    xAxis: { type: "value" as const, splitLine: { lineStyle: { color: "#333" } } },
    yAxis: {
      type: "category" as const,
      data: labels,
      axisLine: { lineStyle: { color: "#555" } },
      axisLabel: { color: "#999" },
    },
    series: [
      {
        name: "<30 fps",
        type: "bar" as const,
        stack: "total",
        data: data.map((d) => d.unplayable),
        itemStyle: { color: "#ef4444" },
      },
      {
        name: "30-59",
        type: "bar" as const,
        stack: "total",
        data: data.map((d) => d.playable),
        itemStyle: { color: "#eab308" },
      },
      {
        name: "60-119",
        type: "bar" as const,
        stack: "total",
        data: data.map((d) => d.smooth),
        itemStyle: { color: "#22c55e" },
      },
      {
        name: "≥120",
        type: "bar" as const,
        stack: "total",
        data: data.map((d) => d.excellent),
        itemStyle: { color: "#3b82f6" },
      },
    ],
  }

  return <EChartWrapper option={option} height={250} />
}

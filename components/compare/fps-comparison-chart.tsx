"use client"

import { EChartWrapper } from "@/components/charts/EChartWrapper"

interface GameWithStats {
  id: string
  title: string
  stats: {
    avgFps: number | null
    avgOnePercentLow: number | null
    deviceBreakdown: Array<{ hardwareSlug: string; count: number; avgFps: number }>
  }
}

export function FpsComparisonChart({ games }: { games: GameWithStats[] }) {
  if (games.length === 0) return null

  // Collect all unique devices across games
  const allDevices = [...new Set(games.flatMap(g => g.stats.deviceBreakdown.map(d => d.hardwareSlug)))]

  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"]

  // Build series: one series per game, data points per device
  const series = games.map((game, idx) => ({
    name: game.title,
    type: "bar" as const,
    data: allDevices.map(slug => {
      const device = game.stats.deviceBreakdown.find(d => d.hardwareSlug === slug)
      return device ? device.avgFps : null
    }),
    itemStyle: { color: colors[idx % colors.length] },
    barGap: "10%",
  }))

  const option = {
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    legend: {
      data: games.map(g => g.title),
      textStyle: { color: "#999" },
      top: 0,
    },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: allDevices.map(s => s.replace(/-/g, " ")),
      axisLine: { lineStyle: { color: "#555" } },
      axisLabel: { color: "#999" },
    },
    yAxis: {
      type: "value" as const,
      name: "Avg FPS",
      nameTextStyle: { color: "#999" },
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#999" },
    },
    series,
  }

  return <EChartWrapper option={option} height={300} />
}

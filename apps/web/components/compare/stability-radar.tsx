"use client"

import { EChartWrapper } from "@/components/charts/EChartWrapper"

interface GameWithStats {
  id: string
  title: string
  stats: {
    avgFps: number | null
    avgOnePercentLow: number | null
    avgStability: number | null
    medianFps: number | null
    bestFps: number | null
  }
}

export function StabilityRadar({ games }: { games: GameWithStats[] }) {
  if (games.length === 0) return null

  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"]

  // Normalize values to 0-100 scale for radar
  const maxFps = Math.max(...games.map(g => g.stats.bestFps ?? 0), 60)

  const indicators = [
    { name: "Avg FPS", max: maxFps },
    { name: "1% Low", max: maxFps },
    { name: "Stability", max: 100 },
    { name: "Median FPS", max: maxFps },
  ]

  const series = games.map((game, idx) => ({
    value: [
      game.stats.avgFps ?? 0,
      game.stats.avgOnePercentLow ?? 0,
      game.stats.avgStability ?? 0,
      game.stats.medianFps ?? 0,
    ],
    name: game.title,
    lineStyle: { color: colors[idx % colors.length] },
    itemStyle: { color: colors[idx % colors.length] },
    areaStyle: { color: colors[idx % colors.length], opacity: 0.1 },
  }))

  const option = {
    tooltip: { trigger: "item" as const },
    legend: {
      data: games.map(g => g.title),
      textStyle: { color: "#999" },
      bottom: 0,
    },
    radar: {
      indicator: indicators,
      splitLine: { lineStyle: { color: "#333" } },
      splitArea: { areaStyle: { color: ["transparent"] } },
      axisLine: { lineStyle: { color: "#555" } },
      axisName: { color: "#999" },
    },
    series: [{
      type: "radar" as const,
      data: series,
    }],
  }

  return <EChartWrapper option={option} height={350} />
}

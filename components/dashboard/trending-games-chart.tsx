"use client"

import { EChartWrapper, CHART_THEME } from "@/components/charts/EChartWrapper"
import type { EChartsOption } from "echarts"

interface TrendingGame {
  id: string
  title: string
  activity_score: number
  benchmark_count: number
  comment_count: number
  upvote_count: number
}

function buildOption(games: TrendingGame[]): EChartsOption {
  const sorted = [...games].reverse()
  const titles = sorted.map((g) => g.title)
  const scores = sorted.map((g) => g.activity_score)
  const benchmarks = sorted.map((g) => g.benchmark_count)
  const comments = sorted.map((g) => g.comment_count)
  const upvotes = sorted.map((g) => g.upvote_count)

  return {
    backgroundColor: CHART_THEME.bg,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#1a1225",
      borderColor: CHART_THEME.border,
      textStyle: { color: CHART_THEME.text },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const g = sorted[idx]
        return `<div style="font-weight:600;margin-bottom:4px">${g.title}</div>
<div>Activity Score: <b>${g.activity_score}</b></div>
<div style="font-size:12px;color:${CHART_THEME.textMuted};margin-top:4px">
Benchmarks: ${g.benchmark_count} · Comments: ${g.comment_count} · Upvotes: ${g.upvote_count}
</div>`
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.border, type: "dashed" } },
      axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: titles,
      axisLabel: { color: CHART_THEME.text, fontSize: 12, width: 160, overflow: "truncate" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Activity Score",
        type: "bar",
        data: scores,
        barWidth: "60%",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: CHART_THEME.secondary },
              { offset: 1, color: CHART_THEME.primary },
            ],
          },
        },
      },
      {
        name: "Benchmarks",
        type: "bar",
        data: benchmarks,
        barWidth: "60%",
        barGap: "-100%",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: "transparent",
          borderWidth: 1,
          borderColor: CHART_THEME.accent,
        },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
      },
    ],
    animationDuration: 800,
    animationEasing: "cubicOut",
  }
}

export function TrendingGamesChart({ games }: { games: TrendingGame[] }) {
  if (!games.length) return null
  return <EChartWrapper option={buildOption(games)} height={360} className="w-full" />
}

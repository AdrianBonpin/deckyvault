"use client"

import { EChartWrapper, CHART_THEME } from "@/components/charts/EChartWrapper"
import type { EChartsOption } from "echarts"

interface BestRelease {
  id: string
  title: string
  avg_fps: number | null
  benchmark_count: number
}

function buildOption(games: BestRelease[]): EChartsOption {
  const data = games.map((g) => ({
    name: g.title,
    value: [g.benchmark_count, Math.round((g.avg_fps ?? 0) * 10) / 10, g.benchmark_count],
    itemStyle: {
      color: {
        type: "radial" as const,
        x: 0.5,
        y: 0.5,
        r: 0.5,
        colorStops: [
          { offset: 0, color: CHART_THEME.accent },
          { offset: 1, color: CHART_THEME.primary },
        ],
      },
      shadowBlur: 10,
      shadowColor: CHART_THEME.primary + "40",
    },
  }))

  return {
    backgroundColor: CHART_THEME.bg,
    tooltip: {
      trigger: "item",
      backgroundColor: "#1a1225",
      borderColor: CHART_THEME.border,
      textStyle: { color: CHART_THEME.text },
      formatter: (params: any) => {
        const v = params.value
        return `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
<div>Avg FPS: <b>${v[1]}</b></div>
<div>Benchmarks: <b>${v[2]}</b></div>`
      },
    },
    grid: {
      left: "3%",
      right: "6%",
      bottom: "10%",
      top: "10%",
      containLabel: true,
    },
    xAxis: {
      name: "Benchmarks",
      nameLocation: "middle",
      nameGap: 24,
      nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 12 },
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.border, type: "dashed" } },
      axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      axisLine: { lineStyle: { color: CHART_THEME.border } },
      axisTick: { show: false },
    },
    yAxis: {
      name: "Avg FPS",
      nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 12 },
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.border, type: "dashed" } },
      axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      axisLine: { lineStyle: { color: CHART_THEME.border } },
      axisTick: { show: false },
    },
    series: [
      {
        type: "scatter",
        data,
        symbolSize: (val: number[]) => Math.max(12, Math.min(40, val[2] * 3)),
        label: {
          show: true,
          formatter: (p: any) => p.name,
          position: "top",
          color: CHART_THEME.text,
          fontSize: 10,
          overflow: "truncate",
          width: 100,
        },
        emphasis: {
          scale: 1.5,
          itemStyle: {
            shadowBlur: 20,
            shadowColor: CHART_THEME.accent + "60",
          },
        },
      },
    ],
    animationDuration: 800,
    animationEasing: "cubicOut",
  }
}

export function BestReleasesChart({ games }: { games: BestRelease[] }) {
  if (!games.length) return null
  return <EChartWrapper option={buildOption(games)} height={360} className="w-full" />
}

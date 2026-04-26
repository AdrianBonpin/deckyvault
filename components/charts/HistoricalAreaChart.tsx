"use client"

import { useMemo } from "react"
import { EChartWrapper, CHART_THEME, getDeviceColor } from "./EChartWrapper"
import type { EChartsOption } from "echarts"

interface HistoricalEntry {
  period: string
  entries: Array<{
    hardwareSlug: string
    avgFps: number
    count: number
  }>
}

export function HistoricalAreaChart({
  data,
  className,
}: {
  data: HistoricalEntry[]
  className?: string
}) {
  const option = useMemo<EChartsOption>(() => {
    const periods = data.map((d) => d.period)
    const deviceSlugs = [
      ...new Set(data.flatMap((d) => d.entries.map((e) => e.hardwareSlug))),
    ]

    const series = deviceSlugs.map((slug, idx) => ({
      name: slug.replace(/-/g, " "),
      type: "line" as const,
      stack: "total",
      areaStyle: { opacity: 0.3 },
      emphasis: { focus: "series" as const },
      smooth: true,
      data: periods.map((period) => {
        const entry = data
          .find((d) => d.period === period)
          ?.entries.find((e) => e.hardwareSlug === slug)
        return entry?.avgFps ?? null
      }),
      itemStyle: { color: getDeviceColor(idx) },
      lineStyle: { color: getDeviceColor(idx) },
    }))

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1a1025",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text, fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      grid: { top: 30, right: 16, bottom: 24, left: 40 },
      xAxis: {
        type: "category",
        data: periods,
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLine: { lineStyle: { color: CHART_THEME.border } },
      },
      yAxis: {
        type: "value",
        name: "AVG FPS",
        nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
      },
      series,
    }
  }, [data])

  if (data.length === 0) return null

  return <EChartWrapper option={option} height={280} className={className} />
}

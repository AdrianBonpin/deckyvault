"use client"

import { useMemo } from "react"
import { EChartWrapper, CHART_THEME, getDeviceColor } from "./EChartWrapper"
import type { EChartsOption } from "echarts"

interface RangeEntry {
  id: string
  hardwareSlug: string
  fpsLow: number
  fpsAvg: number
  fpsHigh: number
  isRawPerformer: boolean
}

export function FpsRangeChart({
  data,
  className,
}: {
  data: RangeEntry[]
  className?: string
}) {
  const option = useMemo<EChartsOption>(() => {
    const devices = [...new Set(data.map((d) => d.hardwareSlug))]
    const sorted = [...data].sort((a, b) => b.fpsAvg - a.fpsAvg)
    const labels = sorted.map((_, i) => `#${i + 1}`)

    const series = devices.map((device, idx) => ({
      name: device.replace(/-/g, " "),
      type: "bar" as const,
      stack: "range",
      data: sorted.map((entry) => {
        if (entry.hardwareSlug !== device) return 0
        return entry.fpsHigh - entry.fpsLow
      }),
      itemStyle: {
        color: getDeviceColor(idx),
        borderRadius: [2, 2, 0, 0],
      },
      barWidth: "60%",
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
        data: labels,
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLine: { lineStyle: { color: CHART_THEME.border } },
      },
      yAxis: {
        type: "value",
        name: "FPS Range",
        nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
      },
      series,
    }
  }, [data])

  if (data.length === 0) return null

  return <EChartWrapper option={option} height={220} className={className} />
}

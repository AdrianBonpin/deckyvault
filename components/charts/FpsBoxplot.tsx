"use client"

import { useMemo } from "react"
import { EChartWrapper, CHART_THEME, getDeviceColor } from "./EChartWrapper"
import type { EChartsOption } from "echarts"

interface BoxplotEntry {
  hardwareSlug: string
  hardwareName: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export function FpsBoxplot({
  data,
  className,
}: {
  data: BoxplotEntry[]
  className?: string
}) {
  const option = useMemo<EChartsOption>(() => {
    const categories = data.map((d) => d.hardwareName)
    const boxData = data.map((d) => [d.min, d.q1, d.median, d.q3, d.max])

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1025",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text, fontSize: 12 },
        formatter: (params) => {
          const d = (params as { data: number[] }).data
          if (!Array.isArray(d)) return ""
          return `Min: ${d[0]}<br/>Q1: ${d[1]}<br/>Median: ${d[2]}<br/>Q3: ${d[3]}<br/>Max: ${d[4]}`
        },
      },
      grid: { top: 16, right: 16, bottom: 24, left: 40 },
      xAxis: {
        type: "category",
        data: categories,
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLine: { lineStyle: { color: CHART_THEME.border } },
      },
      yAxis: {
        type: "value",
        name: "FPS",
        nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
      },
      series: [
        {
          type: "boxplot",
          data: boxData,
          itemStyle: {
            color: CHART_THEME.primary + "20",
            borderColor: CHART_THEME.primary,
            borderWidth: 2,
          },
          emphasis: {
            itemStyle: {
              borderColor: CHART_THEME.accent,
              borderWidth: 3,
            },
          },
        },
      ],
    }
  }, [data])

  if (data.length === 0) return null

  return <EChartWrapper option={option} height={220} className={className} />
}

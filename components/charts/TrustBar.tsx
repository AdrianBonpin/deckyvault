"use client"

import { useMemo } from "react"
import { EChartWrapper, CHART_THEME } from "./EChartWrapper"
import type { EChartsOption } from "echarts"

interface TrustEntry {
  id: string
  hardwareSlug: string
  upvotes: number
  downvotes: number
  verifiedAt: string | null
  userNotes: string | null
  createdAt: string
}

export function TrustBar({
  data,
  className,
}: {
  data: TrustEntry[]
  className?: string
}) {
  const option = useMemo<EChartsOption>(() => {
    const sorted = [...data]
      .sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes))
      .slice(0, 20)

    const labels = sorted.map((e) => {
      const date = new Date(e.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
      return e.userNotes
        ? `${e.userNotes.slice(0, 20)}...`
        : `Entry ${date}`
    })

    const scores = sorted.map((e) => e.upvotes - e.downvotes)

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1a1025",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text, fontSize: 12 },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : null
          if (!p) return ""
          const idx = (p as { dataIndex: number }).dataIndex
          const entry = sorted[idx]
          if (!entry) return ""
          return `↑${entry.upvotes} ↓${entry.downvotes}${entry.verifiedAt ? " ✅ Verified" : ""}`
        },
      },
      grid: { top: 8, right: 16, bottom: 8, left: 120 },
      xAxis: {
        type: "value",
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
      },
      yAxis: {
        type: "category",
        data: labels,
        inverse: true,
        axisLabel: {
          color: CHART_THEME.textMuted,
          fontSize: 10,
          width: 100,
          overflow: "truncate",
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          data: scores.map((score, idx) => ({
            value: score,
            itemStyle: {
              color: sorted[idx].verifiedAt
                ? CHART_THEME.success
                : CHART_THEME.textSubtle,
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: "60%",
        },
      ],
    }
  }, [data])

  if (data.length === 0) return null

  return (
    <EChartWrapper
      option={option}
      height={Math.min(300, data.length * 28 + 16)}
      className={className}
    />
  )
}

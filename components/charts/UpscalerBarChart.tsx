"use client"

import { useMemo } from "react"
import { EChartWrapper, CHART_THEME, getDeviceColor } from "./EChartWrapper"
import type { EChartsOption } from "echarts"

interface UpscalerStat {
  fsrVersion: string
  frameGenMethod: string
  hardwareSlug: string
  avgFps: number
  count: number
}

function formatCombo(fsr: string, fg: string): string {
  const parts: string[] = []
  if (fsr !== "none") parts.push(fsr.toUpperCase())
  if (fg !== "none") parts.push(fg === "fsr_fg" ? "FSR FG" : "DLSS FG")
  return parts.length > 0 ? parts.join(" + ") : "Native"
}

export function UpscalerBarChart({
  data,
  className,
}: {
  data: UpscalerStat[]
  className?: string
}) {
  const option = useMemo<EChartsOption>(() => {
    const combos = [
      ...new Set(
        data.map((d) => formatCombo(d.fsrVersion, d.frameGenMethod)),
      ),
    ]
    const deviceSlugs = [...new Set(data.map((d) => d.hardwareSlug))]

    const series = deviceSlugs.map((slug, idx) => ({
      name: slug.replace(/-/g, " "),
      type: "bar" as const,
      data: combos.map((combo) => {
        const match = data.find(
          (d) =>
            formatCombo(d.fsrVersion, d.frameGenMethod) === combo &&
            d.hardwareSlug === slug,
        )
        return match?.avgFps ?? 0
      }),
      itemStyle: { color: getDeviceColor(idx), borderRadius: [4, 4, 0, 0] },
      barGap: "10%",
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
      grid: { top: 30, right: 16, bottom: 50, left: 40 },
      xAxis: {
        type: "category",
        data: combos,
        axisLabel: {
          color: CHART_THEME.textMuted,
          fontSize: 10,
          rotate: 30,
        },
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

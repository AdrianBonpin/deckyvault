"use client"

import { useMemo } from "react"
import { EChartWrapper, CHART_THEME, getDeviceColor } from "./EChartWrapper"
import type { EChartsOption } from "echarts"

interface DeviceEntry {
  hardwareSlug: string
  hardwareName: string
  count: number
}

export function DeviceDonut({
  data,
  className,
}: {
  data: DeviceEntry[]
  className?: string
}) {
  const option = useMemo<EChartsOption>(() => {
    const total = data.reduce((sum, d) => sum + d.count, 0)

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1025",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text, fontSize: 12 },
        formatter: "{b}: {c} ({d}%)",
      },
      series: [
        {
          type: "pie",
          radius: ["50%", "75%"],
          center: ["50%", "55%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: "#100b14",
            borderWidth: 2,
          },
          label: {
            show: true,
            position: "center",
            formatter: `{total|${total}}\n{label|entries}`,
            rich: {
              total: {
                fontSize: 22,
                fontWeight: "bold",
                color: CHART_THEME.text,
                lineHeight: 30,
              },
              label: {
                fontSize: 11,
                color: CHART_THEME.textMuted,
              },
            },
          },
          emphasis: {
            label: { show: true },
          },
          data: data.map((d, idx) => ({
            name: d.hardwareName,
            value: d.count,
            itemStyle: { color: getDeviceColor(idx) },
          })),
        },
      ],
    }
  }, [data])

  if (data.length === 0) return null

  return <EChartWrapper option={option} height={220} className={className} />
}

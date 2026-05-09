"use client"

import { EChartWrapper, getDeviceColor } from "./EChartWrapper"

interface BatteryLifePoint {
  id: string
  hardwareSlug: string
  tdpWatts: number
  estimatedBatteryMin: number
  estimatedBatteryHours: number
  wattHours: number | null
  tdpMax: number | null
  estimatedAtMaxTdpMin: number | null
}

interface BatteryLifeChartProps {
  data: BatteryLifePoint[]
  deviceNames?: Record<string, string>
}

export function BatteryLifeChart({ data, deviceNames }: BatteryLifeChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-text/40">No battery data available</div>
  }

  // Group by device for separate series
  const deviceGroups = new Map<string, BatteryLifePoint[]>()
  for (const point of data) {
    const existing = deviceGroups.get(point.hardwareSlug) || []
    existing.push(point)
    deviceGroups.set(point.hardwareSlug, existing)
  }

  // Build trend lines: for each device, compute wattHours / tdp = hours for a range of TDPs
  const series: Array<Record<string, unknown>> = []
  let seriesIdx = 0

  for (const [slug, points] of deviceGroups.entries()) {
    const color = getDeviceColor(seriesIdx)
    const name = deviceNames?.[slug] || slug

    // Scatter points: TDP vs battery hours
    series.push({
      name,
      type: "scatter" as const,
      data: points.map((p) => [p.tdpWatts, p.estimatedBatteryHours]),
      itemStyle: { color },
      symbolSize: 10,
    })

    // Trend line: compute theoretical curve using average wattHours for this device
    const avgWh = points.reduce((sum, p) => sum + (p.wattHours ?? 0), 0) / points.length
    if (avgWh > 0) {
      const tdpRange = [2, 5, 8, 10, 12, 15, 18, 20, 25, 30].filter(
        (tdp) => tdp <= (points[0].tdpMax ?? 30),
      )
      series.push({
        name: `${name} (est.)`,
        type: "line" as const,
        data: tdpRange.map((tdp) => [tdp, Math.round((avgWh / tdp) * 10) / 10]),
        lineStyle: { color, type: "dashed" as const, width: 1 },
        symbol: "none",
        silent: true,
      })
    }

    seriesIdx++
  }

  const option = {
    tooltip: {
      trigger: "item" as const,
      formatter: (params: unknown) => {
        const p = params as { seriesName?: string; value?: [number, number] }
        if (!p.seriesName || p.seriesName.includes("(est.)")) return ""
        return `${p.seriesName}<br/>TDP: ${p.value?.[0]}W<br/>Battery: ~${p.value?.[1]}h`
      },
    },
    legend: {
      textStyle: { color: "#999" },
      top: 0,
    },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "value" as const,
      name: "TDP (W)",
      nameTextStyle: { color: "#999" },
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#999" },
    },
    yAxis: {
      type: "value" as const,
      name: "Battery (h)",
      nameTextStyle: { color: "#999" },
      splitLine: { lineStyle: { color: "#333" } },
      axisLabel: { color: "#999" },
    },
    series,
  }

  return <EChartWrapper option={option} height={300} />
}

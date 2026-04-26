"use client"

import { useRef, useCallback } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"

// Project theme colors matching globals.css
export const CHART_THEME = {
  bg: "transparent",
  text: "#ebe4f1",
  textMuted: "#6b5a7d",
  textSubtle: "#4a3a5c",
  border: "#3d2d52",
  primary: "#eb3779",
  secondary: "#571b8b",
  accent: "#fb793c",
  success: "#22c55e",
  info: "#3b82f6",
  warning: "#f59e0b",
  // Device-specific colors
  deviceColors: [
    "#eb3779", // primary (OLED)
    "#571b8b", // secondary (LCD)
    "#fb793c", // accent (Steam Machine)
    "#22c55e",
    "#3b82f6",
    "#f59e0b",
    "#a78bfa",
    "#ec4899",
  ],
}

export function getDeviceColor(index: number): string {
  return CHART_THEME.deviceColors[index % CHART_THEME.deviceColors.length]
}

export function EChartWrapper({
  option,
  height = 300,
  className = "",
}: {
  option: EChartsOption
  height?: number
  className?: string
}) {
  const chartRef = useRef<ReactECharts>(null)

  const onEvents = useCallback(
    () => ({
      // Placeholder for future event handlers
    }),
    [],
  )

  return (
    <div className={className} style={{ height }}>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        onEvents={onEvents()}
        theme={undefined}
      />
    </div>
  )
}

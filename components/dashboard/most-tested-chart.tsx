"use client"

import { EChartWrapper, CHART_THEME } from "@/components/charts/EChartWrapper"
import type { EChartsOption } from "echarts"

interface MostTestedGame {
  id: string
  title: string
  benchmark_count: number
}

interface MostReportedGame {
  id: string
  title: string
  report_count: number
}

function buildOption(
  tested: MostTestedGame[],
  reported: MostReportedGame[],
): EChartsOption {
  const testedTitles = tested.map((g) => g.title)
  const testedCounts = tested.map((g) => g.benchmark_count)
  const reportedTitles = reported.map((g) => g.title)
  const reportedCounts = reported.map((g) => g.report_count)

  return {
    backgroundColor: CHART_THEME.bg,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#1a1225",
      borderColor: CHART_THEME.border,
      textStyle: { color: CHART_THEME.text },
    },
    legend: {
      data: ["Most Tested", "Most Reported"],
      textStyle: { color: CHART_THEME.textMuted },
      bottom: 0,
    },
    grid: [
      {
        left: "3%",
        right: "52%",
        bottom: "14%",
        top: "8%",
        containLabel: true,
      },
      {
        left: "52%",
        right: "3%",
        bottom: "14%",
        top: "8%",
        containLabel: true,
      },
    ],
    xAxis: [
      {
        type: "value",
        gridIndex: 0,
        splitLine: { lineStyle: { color: CHART_THEME.border, type: "dashed" } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      {
        type: "value",
        gridIndex: 1,
        splitLine: { lineStyle: { color: CHART_THEME.border, type: "dashed" } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
    ],
    yAxis: [
      {
        type: "category",
        gridIndex: 0,
        data: testedTitles,
        axisLabel: { color: CHART_THEME.text, fontSize: 11, width: 120, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      {
        type: "category",
        gridIndex: 1,
        data: reportedTitles,
        axisLabel: { color: CHART_THEME.text, fontSize: 11, width: 120, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
    ],
    series: [
      {
        name: "Most Tested",
        type: "bar",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: testedCounts,
        barWidth: "55%",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: CHART_THEME.info },
              { offset: 1, color: CHART_THEME.success },
            ],
          },
        },
      },
      {
        name: "Most Reported",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: reportedCounts,
        barWidth: "55%",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: CHART_THEME.warning },
              { offset: 1, color: CHART_THEME.accent },
            ],
          },
        },
      },
    ],
    animationDuration: 800,
    animationEasing: "cubicOut",
  }
}

export function MostTestedChart({
  mostTested,
  mostReported,
}: {
  mostTested: MostTestedGame[]
  mostReported: MostReportedGame[]
}) {
  if (!mostTested.length && !mostReported.length) return null
  return (
    <EChartWrapper
      option={buildOption(mostTested, mostReported)}
      height={420}
      className="w-full"
    />
  )
}

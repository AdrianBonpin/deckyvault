"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Users, Monitor, Tag } from "lucide-react"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { LineChart, BarChart } from "echarts/charts"
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

interface AnalyticsData {
  benchmarkTimeline: Array<{ day: string; count: number }>
  userTimeline: Array<{ day: string; count: number }>
  deviceDistribution: Array<{ hardwareSlug: string; hardwareName: string; count: number }>
  genrePopularity: Array<{ genre: string; count: number }>
  commentTimeline: Array<{ day: string; count: number }>
}

export function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/analytics/overview")
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="animate-pulse h-96 rounded-lg bg-zinc-800" />
  }

  if (!data) {
    return <div className="text-center py-12 text-text/50">Failed to load analytics</div>
  }

  const benchmarkOption = {
    tooltip: { trigger: "axis" as const },
    xAxis: { type: "category" as const, data: data.benchmarkTimeline.map((d) => d.day), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value" as const },
    series: [{ name: "Benchmarks", type: "line", data: data.benchmarkTimeline.map((d) => d.count), smooth: true, itemStyle: { color: "#eb3779" } }],
    grid: { left: 40, right: 16, top: 16, bottom: 24 },
  }

  const userOption = {
    tooltip: { trigger: "axis" as const },
    xAxis: { type: "category" as const, data: data.userTimeline.map((d) => d.day), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value" as const },
    series: [{ name: "Registrations", type: "line", data: data.userTimeline.map((d) => d.count), smooth: true, itemStyle: { color: "#a78bfa" }, areaStyle: { color: "rgba(167,139,250,0.1)" } }],
    grid: { left: 40, right: 16, top: 16, bottom: 24 },
  }

  const deviceOption = {
    tooltip: { trigger: "axis" as const },
    xAxis: { type: "category" as const, data: data.deviceDistribution.map((d) => d.hardwareName), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value" as const },
    series: [{ name: "Benchmarks", type: "bar", data: data.deviceDistribution.map((d) => d.count), itemStyle: { color: "#fb793c" } }],
    grid: { left: 40, right: 16, top: 16, bottom: 24 },
  }

  const genreOption = {
    tooltip: { trigger: "axis" as const },
    xAxis: { type: "category" as const, data: data.genrePopularity.map((d) => d.genre), axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: "value" as const },
    series: [{ name: "Benchmarks", type: "bar", data: data.genrePopularity.map((d) => d.count), itemStyle: { color: "#22c55e" } }],
    grid: { left: 40, right: 16, top: 16, bottom: 60 },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-zinc-400">90-day trends and distributions</p>
      </div>

      {/* Benchmark Submissions Over Time */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Benchmark Submissions (90d)</h3>
        </div>
        <ReactEChartsCore echarts={echarts} option={benchmarkOption} style={{ height: 240 }} />
      </div>

      {/* User Registrations Over Time */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold">User Registrations (90d)</h3>
        </div>
        <ReactEChartsCore echarts={echarts} option={userOption} style={{ height: 240 }} />
      </div>

      {/* Device Distribution + Genre Popularity (side by side) */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">Device Distribution</h3>
          </div>
          <ReactEChartsCore echarts={echarts} option={deviceOption} style={{ height: 240 }} />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-green-400" />
            <h3 className="text-sm font-semibold">Genre Popularity</h3>
          </div>
          <ReactEChartsCore echarts={echarts} option={genreOption} style={{ height: 240 }} />
        </div>
      </div>
    </div>
  )
}

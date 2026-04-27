"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import {
  Gamepad2Icon,
  TrendingUpIcon,
  DatabaseIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  Loader2,
  RefreshCwIcon,
  MonitorIcon,
} from "lucide-react"
import {
  EChartWrapper,
  CHART_THEME,
  getDeviceColor,
} from "@/components/charts/EChartWrapper"
import type { EChartsOption } from "echarts"

interface DeviceInfo {
  slug: string
  name: string
  deviceType: string
  image: string | null
  colorIndex: number
}

interface UpscalerEntry {
  upscalerType: string
  count: number
  avgFps: number
}

interface DeviceStats {
  slug: string
  name: string
  deviceType: string
  totalBenchmarks: number
  avgFps: number | null
  verifiedCount: number
  gameCount: number
  boxplot: Array<{
    gameId: string
    gameTitle: string
    min: number
    q1: number
    median: number
    q3: number
    max: number
    count: number
  }>
  historical: Array<{
    period: string
    avgFps: number
    count: number
  }>
  topGames: Array<{
    gameId: string
    gameTitle: string
    headerImage: string | null
    avgFps: number
    benchmarkCount: number
  }>
  genreBreakdown: Array<{ genre: string; count: number }>
  protonBreakdown: Array<{ version: string; count: number }>
  upscalerBreakdown: UpscalerEntry[]
}

const deviceTypeLabel: Record<string, string> = {
  handheld: "Handheld",
  console: "Console",
}

const deviceTypeColor: Record<string, string> = {
  handheld: "text-primary bg-primary/10 border-primary/20",
  console: "text-secondary bg-secondary/10 border-secondary/20",
}

export function DeviceDetailClient({ device }: { device: DeviceInfo }) {
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const deviceColor = getDeviceColor(device.colorIndex)

  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hardware/${device.slug}/stats`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error("Failed to fetch device stats:", err)
      setError("Failed to load device statistics. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [device.slug])

  const historicalOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.historical.length === 0) return {}
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1a1020",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: "category",
        data: stats.historical.map((h) => h.period),
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      series: [
        {
          type: "line",
          data: stats.historical.map((h) => h.avgFps),
          smooth: true,
          lineStyle: { color: deviceColor, width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: deviceColor + "40" },
                { offset: 1, color: deviceColor + "05" },
              ],
            },
          },
          symbol: "circle",
          symbolSize: 4,
          itemStyle: { color: deviceColor },
        },
      ],
    }
  }, [stats, deviceColor])

  const boxplotOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.boxplot.length === 0) return {}
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1020",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      grid: { left: 80, right: 20, top: 10, bottom: 40 },
      xAxis: {
        type: "category",
        data: stats.boxplot.map((b) => b.gameTitle),
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10, rotate: 30 },
      },
      yAxis: {
        type: "value",
        name: "FPS",
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
        nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      series: [
        {
          type: "boxplot",
          data: stats.boxplot.map((b) => [b.min, b.q1, b.median, b.q3, b.max]),
          itemStyle: { color: deviceColor + "30", borderColor: deviceColor },
        },
      ],
    }
  }, [stats, deviceColor])

  const genreOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.genreBreakdown.length === 0) return {}
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1025",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          center: ["50%", "50%"],
          data: stats.genreBreakdown.map((g, i) => ({
            name: g.genre,
            value: g.count,
            itemStyle: {
              color: CHART_THEME.deviceColors[i % CHART_THEME.deviceColors.length],
            },
          })),
          label: { color: CHART_THEME.textMuted, fontSize: 10 },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" },
          },
        },
      ],
    }
  }, [stats])

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <div
              className="flex items-center justify-center h-14 w-14 rounded-xl shrink-0"
              style={{ background: `${deviceColor}15` }}
            >
              {device.image ? (
                <Image
                  src={device.image}
                  alt={device.name}
                  width={56}
                  height={56}
                  className="object-contain"
                />
              ) : (
                <Gamepad2Icon className="h-7 w-7" style={{ color: deviceColor }} />
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{device.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
                    deviceTypeColor[device.deviceType] || "text-text/50 bg-text/5 border-border"
                  }`}
                >
                  <Gamepad2Icon className="h-3 w-3" />
                  {deviceTypeLabel[device.deviceType] || device.deviceType}
                </span>
                {stats && stats.verifiedCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <CheckCircleIcon className="h-3 w-3" />
                    {stats.verifiedCount} verified
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-text/60">Performance benchmarks and statistics</p>
        </div>
      </motion.div>

      {/* Overview Stats */}
      {stats && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4">
            <StatCard icon={DatabaseIcon} label="Total Benchmarks" value={String(stats.totalBenchmarks)} />
            <StatCard icon={TrendingUpIcon} label="Average FPS" value={stats.avgFps !== null ? String(stats.avgFps) : "—"} />
            <StatCard icon={MonitorIcon} label="Games Tested" value={String(stats.gameCount)} />
            <StatCard icon={CheckCircleIcon} label="Verified" value={String(stats.verifiedCount)} />
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="px-4 md:px-[10svw]">
          <div className="max-w-7xl mx-auto text-center py-16 text-text/40">
            <Gamepad2Icon className="h-10 w-10 mx-auto mb-3" />
            <p className="text-text/60 mb-4">{error}</p>
            <button
              onClick={fetchStats}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <RefreshCwIcon className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Charts */}
      {stats && !loading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {stats.historical.length > 0 && (
              <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                <h3 className="text-sm font-medium text-text/80 mb-2">Historical Performance</h3>
                <EChartWrapper option={historicalOption} height={280} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {stats.boxplot.length > 0 && (
                <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                  <h3 className="text-sm font-medium text-text/80 mb-2">FPS Distribution by Game</h3>
                  <EChartWrapper option={boxplotOption} height={300} />
                </div>
              )}
              {stats.genreBreakdown.length > 0 && (
                <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                  <h3 className="text-sm font-medium text-text/80 mb-2">Genre Breakdown</h3>
                  <EChartWrapper option={genreOption} height={300} />
                </div>
              )}
            </div>

            {(stats.protonBreakdown.length > 0 || stats.upscalerBreakdown.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {stats.protonBreakdown.length > 0 && (
                  <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                    <h3 className="text-sm font-medium text-text/80 mb-3">Proton Version Distribution</h3>
                    <div className="space-y-2">
                      {stats.protonBreakdown.map((p) => (
                        <div key={p.version} className="flex items-center justify-between text-sm">
                          <span className="text-text/70">{p.version}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-text/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(5, (p.count / stats.totalBenchmarks) * 100)}%` }}
                              />
                            </div>
                            <span className="text-text/50 text-xs">{p.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {stats.upscalerBreakdown.length > 0 && (
                  <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                    <h3 className="text-sm font-medium text-text/80 mb-3">Upscaler Performance</h3>
                    <div className="space-y-2">
                      {stats.upscalerBreakdown.map((f) => (
                        <div key={f.upscalerType} className="flex items-center justify-between text-sm">
                          <span className="text-text/70 capitalize">
                            {f.upscalerType === "none" ? "Native" : f.upscalerType.toUpperCase()}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-text/80 font-medium tabular-nums">{f.avgFps} FPS</span>
                            <span className="text-text/40 text-xs">({f.count})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {stats.topGames.length > 0 && (
              <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                <h3 className="text-sm font-medium text-text/80 mb-3">Top Games by Average FPS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {stats.topGames.slice(0, 8).map((game, i) => (
                    <Link
                      key={game.gameId}
                      href={`/game/${game.gameId}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-text/5 border border-border hover:border-primary/30 transition-colors group"
                    >
                      <div className="text-lg font-bold tabular-nums w-6" style={{ color: deviceColor }}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {game.gameTitle}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-text/50">
                          <span className="text-green-400 font-medium">{game.avgFps} FPS</span>
                          <span>{game.benchmarkCount} runs</span>
                        </div>
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-text/20 group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {stats && !loading && !error && stats.totalBenchmarks === 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-[10svw]">
          <div className="text-center py-16 text-text/40">
            <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
            <p>No benchmark data yet for this device</p>
            <p className="text-sm mt-1">Data will appear as benchmarks are submitted</p>
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-text/[0.03] min-w-[160px]">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-text/50">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  )
}

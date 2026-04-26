"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { Gamepad2Icon, TrendingUpIcon, DatabaseIcon, CheckCircleIcon, ArrowRightIcon, Loader2 } from "lucide-react"
import { EChartWrapper, CHART_THEME, getDeviceColor } from "@/components/charts/EChartWrapper"
import type { EChartsOption } from "echarts"

interface DeviceInfo {
  slug: string
  name: string
  deviceType: string
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
  fsrBreakdown: Array<{ version: string; count: number; avgFps: number }>
}

const deviceTypeLabel: Record<string, string> = {
  handled: "Handheld",
  console: "Console",
}

export function DeviceDetailClient({ device }: { device: DeviceInfo }) {
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchStats() {
      setLoading(true)
      try {
        const res = await fetch(`/api/hardware/${device.slug}/stats`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch (err) {
        console.error("Failed to fetch device stats:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [device.slug])

  const deviceColor = getDeviceColor(0)

  // ── Chart Options ──────────────────────────────────────────
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
        backgroundColor: "#1a1020",
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
            itemStyle: { color: CHART_THEME.deviceColors[i % CHART_THEME.deviceColors.length] },
          })),
          label: {
            color: CHART_THEME.textMuted,
            fontSize: 10,
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" },
          },
        },
      ],
    }
  }, [stats])

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* ── Hero Header ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">{device.name}</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary border border-secondary/30 capitalize">
              <Gamepad2Icon className="h-3 w-3" />
              {deviceTypeLabel[device.deviceType] || device.deviceType}
            </span>
          </div>
          <p className="text-sm text-text/60">
            Performance benchmarks and statistics
          </p>
        </div>
      </motion.div>

      {/* ── Overview Stats ────────────────────────────────── */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4">
            <StatCard icon={DatabaseIcon} label="Total Benchmarks" value={String(stats.totalBenchmarks)} />
            <StatCard icon={TrendingUpIcon} label="Average FPS" value={stats.avgFps !== null ? String(stats.avgFps) : "—"} />
            <StatCard icon={Gamepad2Icon} label="Games Tested" value={String(stats.gameCount)} />
            <StatCard icon={CheckCircleIcon} label="Verified" value={String(stats.verifiedCount)} />
          </div>
        </motion.div>
      )}

      {/* ── Loading State ─────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* ── Charts Section ────────────────────────────────── */}
      {stats && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {/* Row 1: Historical FPS */}
            {stats.historical.length > 0 && (
              <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                <h3 className="text-sm font-medium text-text/80 mb-2">Historical Performance</h3>
                <EChartWrapper option={historicalOption} height={280} />
              </div>
            )}

            {/* Row 2: FPS Distribution + Genre Breakdown */}
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

            {/* Row 3: Proton & FSR Breakdown */}
            {(stats.protonBreakdown.length > 0 || stats.fsrBreakdown.length > 0) && (
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
                {stats.fsrBreakdown.length > 0 && (
                  <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                    <h3 className="text-sm font-medium text-text/80 mb-3">FSR Version Performance</h3>
                    <div className="space-y-2">
                      {stats.fsrBreakdown.map((f) => (
                        <div key={f.version} className="flex items-center justify-between text-sm">
                          <span className="text-text/70 capitalize">{f.version === "none" ? "Native" : f.version.toUpperCase()}</span>
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

            {/* Row 4: Top Games */}
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
                      <div className="text-lg font-bold text-text/20 tabular-nums w-6">{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{game.gameTitle}</p>
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

      {/* ── Empty state ──────────────────────────────────── */}
      {stats && !loading && stats.totalBenchmarks === 0 && (
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

"use client"

import { useState, useCallback } from "react"
import { motion } from "motion/react"
import { BarChart3Icon } from "lucide-react"
import { GameSelector } from "@/components/compare/game-selector"
import { StatsComparison } from "@/components/compare/stats-comparison"
import { FpsComparisonChart } from "@/components/compare/fps-comparison-chart"
import { StabilityRadar } from "@/components/compare/stability-radar"

interface SelectedGame {
  id: string
  appId: number | null
  title: string
  image: string | null
  source: string
}

interface GameComparisonData {
  id: string
  title: string
  stats: {
    totalEntries: number
    avgFps: number | null
    medianFps: number | null
    bestFps: number | null
    avgOnePercentLow: number | null
    avgStability: number | null
    bestDevice: string | null
    tierBreakdown: { unplayable: number; playable: number; smooth: number; excellent: number } | null
    deviceBreakdown: Array<{ hardwareSlug: string; count: number; avgFps: number }>
  }
}

export default function ComparePage() {
  const [selectedGames, setSelectedGames] = useState<SelectedGame[]>([])
  const [comparisonData, setComparisonData] = useState<GameComparisonData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = useCallback((game: SelectedGame) => {
    setSelectedGames(prev => {
      if (prev.some(g => g.id === game.id)) return prev
      return [...prev, game]
    })
  }, [])

  const handleRemove = useCallback((gameId: string) => {
    setSelectedGames(prev => prev.filter(g => g.id !== gameId))
    setComparisonData(prev => prev.filter(g => g.id !== gameId))
  }, [])

  const fetchComparison = useCallback(async () => {
    if (selectedGames.length < 2) return

    setLoading(true)
    setError(null)
    try {
      const ids = selectedGames.map(g => g.id).join(",")
      const res = await fetch(`/api/compare/games?ids=${ids}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to fetch comparison")
      }
      const data = await res.json()
      setComparisonData(data.games || [])
    } catch (err: any) {
      setError(err.message || "Failed to load comparison")
    } finally {
      setLoading(false)
    }
  }, [selectedGames])

  const canCompare = selectedGames.length >= 2

  return (
    <section className="w-full min-h-[calc(100vh-3.6rem)] flex flex-col items-center p-4 md:px-[10svw]">
      <div className="w-full max-w-7xl">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-light mb-2"
        >
          Compare Games
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className="text-text/60 text-sm mb-6"
        >
          Select 2-4 games to compare performance stats side by side.
        </motion.p>

        {/* Game selector */}
        <GameSelector
          selectedGames={selectedGames}
          onSelect={handleSelect}
          onRemove={handleRemove}
          maxSelections={4}
        />

        {/* Compare button */}
        <div className="mt-4">
          <button
            onClick={fetchComparison}
            disabled={!canCompare || loading}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? "Loading..." : "Compare"}
          </button>
          {!canCompare && selectedGames.length > 0 && (
            <span className="ml-3 text-xs text-text/40">Select at least 2 games</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        )}

        {/* Results */}
        {comparisonData.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex flex-col gap-8"
          >
            {/* Stats comparison table */}
            <div className="rounded-xl border border-border bg-text/3 p-4">
              <h2 className="text-sm font-medium text-text/80 mb-4">Stats Overview</h2>
              <StatsComparison games={comparisonData} />
            </div>

            {/* FPS comparison bar chart */}
            <div className="rounded-xl border border-border bg-text/3 p-4">
              <h2 className="text-sm font-medium text-text/80 mb-2">FPS by Device</h2>
              <FpsComparisonChart games={comparisonData} />
            </div>

            {/* Stability radar */}
            <div className="rounded-xl border border-border bg-text/3 p-4">
              <h2 className="text-sm font-medium text-text/80 mb-2">Performance Profile</h2>
              <StabilityRadar games={comparisonData} />
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {comparisonData.length === 0 && !loading && (
          <div className="mt-16 flex flex-col items-center justify-center gap-4">
            <BarChart3Icon className="h-12 w-12 text-text/20" />
            <p className="text-text/40 text-sm">Select games above to start comparing</p>
          </div>
        )}
      </div>
    </section>
  )
}

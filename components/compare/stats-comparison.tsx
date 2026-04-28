"use client"

interface GameWithStats {
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

function StatRow({ label, values }: { label: string; values: (string | number | null)[] }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
      {values.map((val, i) => (
        <div key={i} className="flex flex-col gap-1 p-3 rounded-lg border border-border bg-text/3">
          <span className="text-[10px] text-text/50 uppercase tracking-wider text-center">{i === 0 ? label : ""}</span>
          <span className="text-sm font-semibold tabular-nums text-center">
            {val !== null && val !== undefined ? val : "—"}
          </span>
        </div>
      ))}
    </div>
  )
}

export function StatsComparison({ games }: { games: GameWithStats[] }) {
  if (games.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Header row with game titles */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${games.length}, 1fr)` }}>
        {games.map(game => (
          <div key={game.id} className="text-center">
            <h3 className="text-sm font-semibold text-text truncate">{game.title}</h3>
            <span className="text-xs text-text/50">{game.stats.totalEntries} entries</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-border" />

      <StatRow label="Avg FPS" values={games.map(g => g.stats.avgFps ? `${g.stats.avgFps}` : null)} />
      <StatRow label="Median FPS" values={games.map(g => g.stats.medianFps ? `${g.stats.medianFps}` : null)} />
      <StatRow label="Best FPS" values={games.map(g => g.stats.bestFps ? `${g.stats.bestFps}` : null)} />
      <StatRow label="Avg 1% Low" values={games.map(g => g.stats.avgOnePercentLow ? `${g.stats.avgOnePercentLow}` : null)} />
      <StatRow label="Stability" values={games.map(g => g.stats.avgStability != null ? `${g.stats.avgStability}%` : null)} />
      <StatRow label="Best Device" values={games.map(g => g.stats.bestDevice ?? null)} />
    </div>
  )
}

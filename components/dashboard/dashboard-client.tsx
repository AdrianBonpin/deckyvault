"use client"

import { TrendingUpIcon, SparklesIcon, BarChart3Icon } from "lucide-react"
import { TrendingGamesChart } from "./trending-games-chart"
import { BestReleasesChart } from "./best-releases-chart"
import { MostTestedChart } from "./most-tested-chart"

interface TrendingGame {
  id: string
  title: string
  capsule_image: string | null
  header_image: string | null
  playability_status: string | null
  benchmark_count: number
  comment_count: number
  upvote_count: number
  activity_score: number
}

interface BestRelease {
  id: string
  title: string
  capsule_image: string | null
  header_image: string | null
  release_date: string | null
  created_at: string | null
  playability_status: string | null
  avg_fps: number | null
  benchmark_count: number
}

interface MostTestedGame {
  id: string
  title: string
  capsule_image: string | null
  header_image: string | null
  playability_status: string | null
  benchmark_count: number
}

interface MostReportedGame {
  id: string
  title: string
  capsule_image: string | null
  header_image: string | null
  report_count: number
}

interface DashboardClientProps {
  trending: TrendingGame[]
  bestNew: BestRelease[]
  mostTested: MostTestedGame[]
  mostReported: MostReportedGame[]
}

export function DashboardClient({
  trending,
  bestNew,
  mostTested,
  mostReported,
}: DashboardClientProps) {
  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-text">
          Community Dashboard
        </h1>
        <p className="text-text/60 mt-1 text-sm md:text-base">
          Real-time insights from the DeckyVault community — trending games, top
          performers, and activity highlights.
        </p>
      </header>

      {/* Trending Games */}
      <section className="rounded-xl border border-border bg-text/[0.03] p-4 md:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TrendingUpIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg md:text-xl font-semibold text-text">
            Trending Games (7 days)
          </h2>
        </div>
        <p className="text-text/60 text-sm">
          Top games by community activity: benchmarks, comments, and upvotes.
        </p>
        <TrendingGamesChart games={trending} />
      </section>

      {/* Best New Releases */}
      <section className="rounded-xl border border-border bg-text/[0.03] p-4 md:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-accent" />
          <h2 className="text-lg md:text-xl font-semibold text-text">
            Best Performing New Releases
          </h2>
        </div>
        <p className="text-text/60 text-sm">
          Newly added games with the highest average FPS (minimum 3 benchmarks).
        </p>
        <BestReleasesChart games={bestNew} />
      </section>

      {/* Most Tested & Most Reported */}
      <section className="rounded-xl border border-border bg-text/[0.03] p-4 md:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BarChart3Icon className="h-5 w-5 text-info" />
          <h2 className="text-lg md:text-xl font-semibold text-text">
            Most Tested & Most Reported
          </h2>
        </div>
        <p className="text-text/60 text-sm">
          Games with the most benchmarks submitted and the most open reports.
        </p>
        <MostTestedChart mostTested={mostTested} mostReported={mostReported} />
      </section>
    </main>
  )
}

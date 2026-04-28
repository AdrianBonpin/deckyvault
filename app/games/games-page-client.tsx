"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import {
  Gamepad2Icon,
  SearchIcon,
  TrendingUpIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react"

interface GamesListItem {
  id: string
  steamAppId: number | null
  title: string
  developer: string | null
  capsuleImage: string | null
  headerImage: string | null
  genres: string[] | null
  source: string
  benchmarkCount: number
  deckStatus: string | null
}

interface DeviceOption {
  slug: string
  name: string
}

type SortOption = "recent" | "name" | "benchmarks"
type SortDirection = "asc" | "desc"

const DECK_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  native: { label: "Native", className: "bg-green-500/10 border-green-500/20 text-green-400" },
  proton: { label: "Proton", className: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  unsupported: { label: "Unsupported", className: "bg-red-500/10 border-red-500/20 text-red-400" },
  unknown: { label: "Unknown", className: "bg-text/5 border-border text-text/40" },
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "name", label: "Name A\u2013Z" },
  { value: "benchmarks", label: "Most Benchmarks" },
]

export function GamesPageClient({
  initialGames,
  totalCount,
  allGenres,
  allDevices,
}: {
  initialGames: GamesListItem[]
  totalCount: number
  allGenres: string[]
  allDevices: DeviceOption[]
}) {
  const [games, setGames] = useState<GamesListItem[]>(initialGames)
  const [total, setTotal] = useState(totalCount)
  const [search, setSearch] = useState("")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedDevice, setSelectedDevice] = useState("")
  const [sort, setSort] = useState<SortOption>("recent")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const hasMore = games.length < total

  const buildUrl = useCallback(
    (offset: number) => {
      const params = new URLSearchParams()
      params.set("offset", String(offset))
      params.set("limit", "24")
      params.set("sort", sort)
      params.set("order", sortDirection)
      if (search) params.set("search", search)
      if (selectedDevice) params.set("device", selectedDevice)
      if (selectedGenres.length === 1) params.set("genre", selectedGenres[0])
      return `/api/games/listing?${params.toString()}`
    },
    [sort, sortDirection, search, selectedDevice, selectedGenres],
  )

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setError(null)
    try {
      const url = buildUrl(games.length)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load games")
      const data = await res.json()
      setGames((prev) => [...prev, ...data.data])
      setTotal(data.total)
    } catch (err) {
      setError("Failed to load more games. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, games.length, buildUrl])

  // Full reload when filters/sort change
  useEffect(() => {
    let cancelled = false

    async function fetchGames() {
      setLoading(true)
      setError(null)
      try {
        const url = buildUrl(0)
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed to load games")
        const data = await res.json()
        if (!cancelled) {
          setGames(data.data)
          setTotal(data.total)
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load games. Please try again.")
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchGames()
    return () => {
      cancelled = true
    }
  }, [buildUrl])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: "200px" },
    )

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current)
    }

    observerRef.current = observer
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    )
  }

  return (
    <section className="w-full flex flex-col gap-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">Games</h1>
          <p className="text-sm text-text/60 mt-1">
            Browse {total.toLocaleString()} games with benchmarks, settings, and performance data
          </p>
        </div>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          {/* Search + Sort Row */}
          <div className="flex flex-row items-center gap-3">
            <label className="flex-1 flex flex-row items-center gap-2 bg-text/5 px-3 py-2 rounded-md border border-border hover:border-border-active focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/50 focus-within:ring-offset-2 focus-within:ring-offset-background transition-colors cursor-text">
              <SearchIcon className="h-4 w-4 text-text/40 shrink-0" />
              <input
                type="text"
                placeholder="Search games..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 outline-none bg-transparent text-sm min-w-0"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-text/40 hover:text-text/70 transition-colors cursor-pointer"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="bg-text/5 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
              className="px-2 py-2 rounded-md text-sm bg-text/5 border border-border hover:bg-text/10 transition-colors cursor-pointer"
              title={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded-md text-sm transition-colors cursor-pointer border ${
                showFilters || selectedDevice || selectedGenres.length > 0
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-text/5 text-text/60 hover:text-text/80 border-border hover:border-border-active"
              }`}
            >
              Filters
              {(selectedDevice || selectedGenres.length > 0) && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-background text-[10px] font-bold">
                  {selectedGenres.length + (selectedDevice ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filter Panel (collapsible) */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-3 pt-1"
            >
              {/* Device filter */}
              <div>
                <span className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
                  Device
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedDevice("")}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      selectedDevice === ""
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "text-text/50 hover:text-text/70 hover:bg-text/5 border border-transparent"
                    }`}
                  >
                    All Devices
                  </button>
                  {allDevices.map((device) => (
                    <button
                      key={device.slug}
                      onClick={() =>
                        setSelectedDevice(selectedDevice === device.slug ? "" : device.slug)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        selectedDevice === device.slug
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "text-text/50 hover:text-text/70 hover:bg-text/5 border border-transparent"
                      }`}
                    >
                      {device.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre filter */}
              <div>
                <span className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
                  Genre
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-hide">
                  {allGenres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        selectedGenres.includes(genre)
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "text-text/50 hover:text-text/70 hover:bg-text/5 border border-transparent"
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear filters */}
              {(selectedDevice || selectedGenres.length > 0) && (
                <button
                  onClick={() => {
                    setSelectedDevice("")
                    setSelectedGenres([])
                  }}
                  className="text-xs text-text/50 hover:text-primary transition-colors cursor-pointer self-start"
                >
                  Clear all filters
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Error State */}
      {error && !loading && (
        <div className="max-w-7xl mx-auto px-4 md:px-0 text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-text/50 hover:text-primary transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {/* Games Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>

        {/* Empty state */}
        {!loading && games.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Gamepad2Icon className="h-12 w-12 text-text/20" />
            <p className="text-text/40 text-sm">
              {search || selectedDevice || selectedGenres.length > 0
                ? "No games match your filters"
                : "No games found"}
            </p>
            {(search || selectedDevice || selectedGenres.length > 0) && (
              <button
                onClick={() => {
                  setSearch("")
                  setSelectedDevice("")
                  setSelectedGenres([])
                }}
                className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Loading indicator for infinite scroll */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2Icon className="h-6 w-6 text-primary animate-spin" />
        </div>
      )}

      {/* End of list */}
      {!loading && !hasMore && games.length > 0 && (
        <div className="text-center py-6">
          <p className="text-text/30 text-xs">
            Showing all {games.length} of {total.toLocaleString()} games
          </p>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}
    </section>
  )
}

function GameCard({ game }: { game: GamesListItem }) {
  const [imgError, setImgError] = useState(false)
  const imageUrl = game.capsuleImage || game.headerImage

  const deckConfig = game.deckStatus
    ? DECK_STATUS_CONFIG[game.deckStatus] ?? DECK_STATUS_CONFIG.unknown
    : null

  return (
    <Link
      href={`/game/${game.id}`}
      className="group rounded-xl border border-border bg-text/3 hover:border-primary/30 transition-all duration-200 overflow-hidden"
    >
      <div className="relative w-full aspect-[2/3] bg-text/10 overflow-hidden">
        {imageUrl && !imgError ? (
          <Image
            src={imageUrl}
            alt={game.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2Icon className="h-8 w-8 text-text/20" />
          </div>
        )}
      </div>
      <div className="p-2.5 sm:p-3">
        <h3 className="text-xs sm:text-sm font-semibold text-text group-hover:text-primary transition-colors line-clamp-2 leading-tight">
          {game.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {game.benchmarkCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-text/50">
              <TrendingUpIcon className="h-3 w-3 text-primary/60" />
              <span className="tabular-nums">{game.benchmarkCount}</span>
            </span>
          ) : (
            <span className="text-[10px] text-text/25 italic">No data yet</span>
          )}
          {deckConfig && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full border ${deckConfig.className}`}
            >
              {deckConfig.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

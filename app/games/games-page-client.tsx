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
import { AntiCheatBadge } from "@/components/anti-cheat-badge"
import { PlayabilityBadge } from "@/components/playability-badge"
import { SavedFilters } from "@/components/saved-filters"

interface GamesListItem {
  id: string
  steamAppId: number | null
  title: string
  developer: string | null
  capsuleImage: string | null
  headerImage: string | null
  genres: string[] | null
  source: string
  steamReviewScore: number | null
  playabilityStatus: "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown" | null
  onlineMultiplayerStatus: "none" | "supported" | "unknown" | null
  benchmarkCount: number
  deckStatus: string | null
  antiCheatRelevant: boolean
  antiCheatStatus: "none" | "supported" | "unsupported" | "unknown" | null
}

interface DeviceOption {
  slug: string
  name: string
}

type SortOption = "recent" | "name" | "benchmarks" | "performance" | "popularity" | "release_date" | "steam_reviews"
type SortDirection = "asc" | "desc"

const DECK_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  native: { label: "Native", className: "bg-green-500/10 border-green-500/20 text-green-400" },
  proton: { label: "Proton", className: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  unsupported: { label: "Unsupported", className: "bg-red-500/10 border-red-500/20 text-red-400" },
  unknown: { label: "Unknown", className: "bg-text/5 border-border text-text/40" },
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "name", label: "Name A–Z" },
  { value: "benchmarks", label: "Most Benchmarks" },
  { value: "performance", label: "Best Performance" },
  { value: "popularity", label: "Most Popular" },
  { value: "release_date", label: "Release Date" },
  { value: "steam_reviews", label: "Steam Reviews" },
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
  const [minFps, setMinFps] = useState<string>("")
  const [maxFps, setMaxFps] = useState<string>("")
  const [fsrSupport, setFsrSupport] = useState<boolean>(false)
  const [protonNative, setProtonNative] = useState<string>("any")
  const [antiCheatStatus, setAntiCheatStatus] = useState<string>("any")
  const [playabilityStatus, setPlayabilityStatus] = useState<string>("")
  const [steamReviewMin, setSteamReviewMin] = useState<string>("")
  const [isFree, setIsFree] = useState<boolean>(false)
  const [hasMultiplayer, setHasMultiplayer] = useState<boolean>(false)
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
      if (minFps) params.set("minFps", minFps)
      if (maxFps) params.set("maxFps", maxFps)
      if (fsrSupport) params.set("fsrSupport", "true")
      if (protonNative !== "any") params.set("protonNative", protonNative)
      if (antiCheatStatus !== "any") params.set("antiCheatStatus", antiCheatStatus)
      if (playabilityStatus) params.set("playabilityStatus", playabilityStatus)
      if (steamReviewMin) params.set("steamReviewScore", steamReviewMin)
      if (isFree) params.set("isFree", "true")
      if (hasMultiplayer) params.set("hasMultiplayer", "true")
      return `/api/games/listing?${params.toString()}`
    },
    [
      sort, sortDirection, search, selectedDevice, selectedGenres,
      minFps, maxFps, fsrSupport, protonNative, antiCheatStatus,
      playabilityStatus, steamReviewMin, isFree, hasMultiplayer,
    ],
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
                showFilters ||
                selectedDevice ||
                selectedGenres.length > 0 ||
                minFps ||
                maxFps ||
                fsrSupport ||
                protonNative !== "any" ||
                antiCheatStatus !== "any" ||
                playabilityStatus ||
                steamReviewMin ||
                isFree ||
                hasMultiplayer
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-text/5 text-text/60 hover:text-text/80 border-border hover:border-border-active"
              }`}
            >
              Filters
              {(selectedDevice ||
                selectedGenres.length > 0 ||
                minFps ||
                maxFps ||
                fsrSupport ||
                protonNative !== "any" ||
                antiCheatStatus !== "any" ||
                playabilityStatus ||
                steamReviewMin ||
                isFree ||
                hasMultiplayer) && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-background text-[10px] font-bold">
                  {selectedGenres.length +
                    (selectedDevice ? 1 : 0) +
                    (minFps ? 1 : 0) +
                    (maxFps ? 1 : 0) +
                    (fsrSupport ? 1 : 0) +
                    (protonNative !== "any" ? 1 : 0) +
                    (antiCheatStatus !== "any" ? 1 : 0) +
                    (playabilityStatus ? 1 : 0) +
                    (steamReviewMin ? 1 : 0) +
                    (isFree ? 1 : 0) +
                    (hasMultiplayer ? 1 : 0)}
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

              {/* Performance Filters */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-300">Performance</h4>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min FPS"
                    value={minFps}
                    onChange={(e) => setMinFps(e.target.value)}
                    className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max FPS"
                    value={maxFps}
                    onChange={(e) => setMaxFps(e.target.value)}
                    className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                  />
                </div>
                <select
                  value={playabilityStatus}
                  onChange={(e) => setPlayabilityStatus(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                >
                  <option value="">Any Playability</option>
                  <option value="great">Plays Great</option>
                  <option value="playable">Playable</option>
                  <option value="needs_tweaks">Needs Tweaks</option>
                  <option value="unplayable">Unplayable</option>
                </select>
              </div>

              {/* Compatibility Filters */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-300">Compatibility</h4>
                <select
                  value={protonNative}
                  onChange={(e) => setProtonNative(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                >
                  <option value="any">Any Runtime</option>
                  <option value="native">Native</option>
                  <option value="proton">Proton</option>
                </select>
                <select
                  value={antiCheatStatus}
                  onChange={(e) => setAntiCheatStatus(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                >
                  <option value="any">Any Anti-Cheat</option>
                  <option value="supported">AC Supported</option>
                  <option value="unsupported">AC Unsupported</option>
                  <option value="unknown">AC Unknown</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fsrSupport}
                    onChange={(e) => setFsrSupport(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  FSR Support
                </label>
              </div>

              {/* Other Filters */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-300">Other</h4>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  Free to Play
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasMultiplayer}
                    onChange={(e) => setHasMultiplayer(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  Has Multiplayer
                </label>
                <input
                  type="number"
                  placeholder="Min Steam Review %"
                  value={steamReviewMin}
                  onChange={(e) => setSteamReviewMin(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
                />
              </div>

              {/* Saved Filters */}
              <SavedFilters
                currentFilters={{
                  minFps,
                  maxFps,
                  fsrSupport,
                  protonNative,
                  antiCheatStatus,
                  playabilityStatus,
                  steamReviewMin,
                  isFree,
                  hasMultiplayer,
                  genre: selectedGenres[0] || "",
                  device: selectedDevice,
                  sortBy: sort,
                }}
                onLoad={(filters) => {
                  setMinFps(filters.minFps || "")
                  setMaxFps(filters.maxFps || "")
                  setFsrSupport(filters.fsrSupport || false)
                  setProtonNative(filters.protonNative || "any")
                  setAntiCheatStatus(filters.antiCheatStatus || "any")
                  setPlayabilityStatus(filters.playabilityStatus || "")
                  setSteamReviewMin(filters.steamReviewMin || "")
                  setIsFree(filters.isFree || false)
                  setHasMultiplayer(filters.hasMultiplayer || false)
                  if (filters.genre) setSelectedGenres([filters.genre])
                  else setSelectedGenres([])
                  if (filters.device) setSelectedDevice(filters.device)
                  else setSelectedDevice("")
                  if (filters.sortBy) setSort(filters.sortBy as SortOption)
                }}
              />

              {/* Clear filters */}
              {(selectedDevice ||
                selectedGenres.length > 0 ||
                minFps ||
                maxFps ||
                fsrSupport ||
                protonNative !== "any" ||
                antiCheatStatus !== "any" ||
                playabilityStatus ||
                steamReviewMin ||
                isFree ||
                hasMultiplayer) && (
                <button
                  onClick={() => {
                    setSelectedDevice("")
                    setSelectedGenres([])
                    setMinFps("")
                    setMaxFps("")
                    setFsrSupport(false)
                    setProtonNative("any")
                    setAntiCheatStatus("any")
                    setPlayabilityStatus("")
                    setSteamReviewMin("")
                    setIsFree(false)
                    setHasMultiplayer(false)
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
              {search ||
              selectedDevice ||
              selectedGenres.length > 0 ||
              minFps ||
              maxFps ||
              fsrSupport ||
              protonNative !== "any" ||
              antiCheatStatus !== "any" ||
              playabilityStatus ||
              steamReviewMin ||
              isFree ||
              hasMultiplayer
                ? "No games match your filters"
                : "No games found"}
            </p>
            {(search ||
              selectedDevice ||
              selectedGenres.length > 0 ||
              minFps ||
              maxFps ||
              fsrSupport ||
              protonNative !== "any" ||
              antiCheatStatus !== "any" ||
              playabilityStatus ||
              steamReviewMin ||
              isFree ||
              hasMultiplayer) && (
              <button
                onClick={() => {
                  setSearch("")
                  setSelectedDevice("")
                  setSelectedGenres([])
                  setMinFps("")
                  setMaxFps("")
                  setFsrSupport(false)
                  setProtonNative("any")
                  setAntiCheatStatus("any")
                  setPlayabilityStatus("")
                  setSteamReviewMin("")
                  setIsFree(false)
                  setHasMultiplayer(false)
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
        <div className="flex flex-wrap gap-1 mt-1">
          {game.playabilityStatus && (
            <PlayabilityBadge status={game.playabilityStatus} compact showLabel={false} />
          )}
          {game.antiCheatRelevant && game.antiCheatStatus === "unsupported" && (
            <AntiCheatBadge
              antiCheatRelevant={true}
              antiCheatStatus={game.antiCheatStatus}
              compact
            />
          )}
        </div>
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

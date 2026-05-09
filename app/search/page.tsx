"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  ExternalLinkIcon,
  Gamepad2Icon,
  MessageSquareIcon,
  SettingsIcon,
  TrendingUpIcon,
  DatabaseIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { FaSteam } from "react-icons/fa"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "@/lib/auth-client"
import { WindowsIcon, MacIcon, LinuxIcon } from "@/app/components/PlatformIcons"
import { AntiCheatBadge } from "@/components/anti-cheat-badge"
import { PlayabilityBadge } from "@/components/playability-badge"
import { SavedFilters } from "@/components/saved-filters"

interface UnifiedResult {
  kind: "local" | "steam"
  id?: string
  appId: number | null
  title: string
  image: string | null
  developer: string | null
  publisher: string | null
  description: string | null
  genres: string[] | null
  source: string
  counts: { benchmarks: number; presets: number; comments: number } | null
  platformSupport: {
    isSupported: boolean
    protonStatus: string
    antiCheatRelevant: boolean
    antiCheatName: string | null
    antiCheatStatus: string
  } | null
  metascore?: string | null
  price?: { currency: string; initial: number; final: number } | null
  platforms?: { windows: boolean; mac: boolean; linux: boolean } | null
  controllerSupport?: string | null
  isRawPerformer?: boolean
  isPoorPerformance?: boolean
  bestFps?: number | null
  estimatedBatteryMin?: number | null
  latestVersion?: string | null
  tinyImage?: string | null
  // Badges & review fields
  playabilityStatus?: "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown" | null
  steamReviewScore?: number | null
  steamReviewSentiment?: string | null
  antiCheatRelevant?: boolean
  antiCheatStatus?: string | null
  antiCheatName?: string | null
}

const DEVICE_OPTIONS = [
  { slug: "steam-deck-oled", name: "Steam Deck OLED" },
  { slug: "steam-deck-lcd", name: 'Steam Deck LCD' },
  { slug: "rog-ally", name: "ROG Ally" },
]

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const query = searchParams.get("q") || ""

  const [results, setResults] = useState<UnifiedResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isValidQuery = query && query.length >= 2

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState("")
  const [minFps, setMinFps] = useState("")
  const [maxFps, setMaxFps] = useState("")
  const [fsrSupport, setFsrSupport] = useState(false)
  const [protonNative, setProtonNative] = useState("any")
  const [antiCheatStatus, setAntiCheatStatus] = useState("any")
  const [playabilityStatus, setPlayabilityStatus] = useState("")
  const [steamReviewMin, setSteamReviewMin] = useState("")
  const [isFree, setIsFree] = useState(false)
  const [hasMultiplayer, setHasMultiplayer] = useState(false)

  const hasActiveFilters =
    selectedDevice ||
    minFps ||
    maxFps ||
    fsrSupport ||
    protonNative !== "any" ||
    antiCheatStatus !== "any" ||
    playabilityStatus ||
    steamReviewMin ||
    isFree ||
    hasMultiplayer

  const activeFilterCount =
    (selectedDevice ? 1 : 0) +
    (minFps ? 1 : 0) +
    (maxFps ? 1 : 0) +
    (fsrSupport ? 1 : 0) +
    (protonNative !== "any" ? 1 : 0) +
    (antiCheatStatus !== "any" ? 1 : 0) +
    (playabilityStatus ? 1 : 0) +
    (steamReviewMin ? 1 : 0) +
    (isFree ? 1 : 0) +
    (hasMultiplayer ? 1 : 0)

  // Handle direct navigation / browser back-forward
  useEffect(() => {
    if (!isValidQuery) return

    let cancelled = false

    async function fetchResults() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set("q", query)
        if (selectedDevice) params.set("device", selectedDevice)
        if (minFps) params.set("minFps", minFps)
        if (maxFps) params.set("maxFps", maxFps)
        if (fsrSupport) params.set("fsrSupport", "true")
        if (protonNative !== "any") params.set("protonNative", protonNative)
        if (antiCheatStatus !== "any") params.set("antiCheatStatus", antiCheatStatus)
        if (playabilityStatus) params.set("playabilityStatus", playabilityStatus)
        if (steamReviewMin) params.set("steamReviewScore", steamReviewMin)
        if (isFree) params.set("isFree", "true")
        if (hasMultiplayer) params.set("hasMultiplayer", "true")

        const res = await fetch(`/api/search/unified?${params.toString()}`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        if (!cancelled) setResults(data.results || [])
      } catch (err) {
        if (!cancelled) {
          setError("Failed to fetch search results")
          console.error(err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchResults()
    return () => {
      cancelled = true
    }
  }, [isValidQuery, query, selectedDevice, minFps, maxFps, fsrSupport, protonNative, antiCheatStatus, playabilityStatus, steamReviewMin, isFree, hasMultiplayer])

  function handleClick(result: UnifiedResult) {
    const path = result.appId
      ? `/game/${result.appId}?sync=1`
      : `/game/${result.id}?sync=1`
    router.push(path)
  }

  function clearAllFilters() {
    setSelectedDevice("")
    setMinFps("")
    setMaxFps("")
    setFsrSupport(false)
    setProtonNative("any")
    setAntiCheatStatus("any")
    setPlayabilityStatus("")
    setSteamReviewMin("")
    setIsFree(false)
    setHasMultiplayer(false)
  }

  return (
    <section className="w-full min-h-[calc(100vh-3.6rem)] flex flex-col items-center p-4 md:px-[10svw]">
      <div className="w-full max-w-7xl">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-light mb-2"
        >
          {query ? `Results for "${query}"` : "Search using game name or AppID"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className="text-text/60 text-sm mb-4"
        >
          {query
            ? `${results.length} result${results.length !== 1 ? "s" : ""} found`
            : "Enter a game name or AppID to find benchmarks, settings, and reviews."}
        </motion.p>

        {/* Filter toggle button */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer border min-h-[44px] ${
              showFilters || hasActiveFilters
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-text/5 text-text/60 hover:text-text/80 border-border hover:border-border-active"
            }`}
          >
            <SlidersHorizontalIcon className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-background text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-text/50 hover:text-primary transition-colors cursor-pointer min-h-[44px] flex items-center gap-1"
            >
              <XIcon className="h-3 w-3" />
              Clear all filters
            </button>
          )}
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-text/[0.03]">
                {/* Device filter */}
                <div>
                  <span className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
                    Device
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedDevice("")}
                      className={`px-3 py-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer min-h-[44px] ${
                        selectedDevice === ""
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "text-text/50 hover:text-text/70 hover:bg-text/5 border border-transparent"
                      }`}
                    >
                      All Devices
                    </button>
                    {DEVICE_OPTIONS.map((device) => (
                      <button
                        key={device.slug}
                        onClick={() =>
                          setSelectedDevice(selectedDevice === device.slug ? "" : device.slug)
                        }
                        className={`px-3 py-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer min-h-[44px] ${
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

                {/* Performance Filters */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-300">Performance</h4>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min FPS"
                      value={minFps}
                      onChange={(e) => setMinFps(e.target.value)}
                      className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2.5 text-sm min-h-[44px]"
                    />
                    <input
                      type="number"
                      placeholder="Max FPS"
                      value={maxFps}
                      onChange={(e) => setMaxFps(e.target.value)}
                      className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2.5 text-sm min-h-[44px]"
                    />
                  </div>
                  <select
                    value={playabilityStatus}
                    onChange={(e) => setPlayabilityStatus(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2.5 text-sm min-h-[44px]"
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
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2.5 text-sm min-h-[44px]"
                  >
                    <option value="any">Any Runtime</option>
                    <option value="native">Native</option>
                    <option value="proton">Proton</option>
                  </select>
                  <select
                    value={antiCheatStatus}
                    onChange={(e) => setAntiCheatStatus(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2.5 text-sm min-h-[44px]"
                  >
                    <option value="any">Any Anti-Cheat</option>
                    <option value="supported">AC Supported</option>
                    <option value="unsupported">AC Unsupported</option>
                    <option value="unknown">AC Unknown</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm py-2 min-h-[44px]">
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
                  <label className="flex items-center gap-2 text-sm py-2 min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={isFree}
                      onChange={(e) => setIsFree(e.target.checked)}
                      className="rounded border-zinc-600"
                    />
                    Free to Play
                  </label>
                  <label className="flex items-center gap-2 text-sm py-2 min-h-[44px]">
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
                    device: selectedDevice,
                  }}
                  onLoad={(filters) => {
                    setMinFps((filters.minFps as string) || "")
                    setMaxFps((filters.maxFps as string) || "")
                    setFsrSupport((filters.fsrSupport as boolean) || false)
                    setProtonNative((filters.protonNative as string) || "any")
                    setAntiCheatStatus((filters.antiCheatStatus as string) || "any")
                    setPlayabilityStatus((filters.playabilityStatus as string) || "")
                    setSteamReviewMin((filters.steamReviewMin as string) || "")
                    setIsFree((filters.isFree as boolean) || false)
                    setHasMultiplayer((filters.hasMultiplayer as boolean) || false)
                    if (filters.device) setSelectedDevice(filters.device as string)
                    else setSelectedDevice("")
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isValidQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <Gamepad2Icon className="h-12 w-12 text-text/20" />
            <p className="text-text/40 text-sm">
              Start typing to search for games
            </p>
          </motion.div>
        )}

        {isValidQuery && loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full"
            />
            <p className="text-text/60 text-sm">
              Searching for &quot;{query}&quot;...
            </p>
          </div>
        )}

        {isValidQuery && !loading && error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}

        {isValidQuery && !loading && !error && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <Gamepad2Icon className="h-12 w-12 text-text/20" />
            <p className="text-text/40 text-sm">
              No results found for &quot;{query}&quot;
            </p>
          </motion.div>
        )}

        {isValidQuery && !loading && !error && results.length > 0 && (
          <motion.div
            className="flex flex-col gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
          >
            <AnimatePresence mode="popLayout">
              {results.map((result, idx) => (
                <SearchResultCard
                  key={
                    result.kind === "local"
                      ? result.id
                      : `steam-${result.appId}-${idx}`
                  }
                  result={result}
                  onClick={handleClick}
                  index={idx}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {session?.user && (
          <div className="mt-6 text-center">
            <p className="text-sm text-text/50">
              Can&apos;t find your game?{" "}
              <Link href="/game/add" className="text-primary hover:underline cursor-pointer">
                Add it manually
              </Link>
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function SearchResultCard({
  result,
  onClick,
  index,
}: {
  result: UnifiedResult
  onClick: (r: UnifiedResult) => void
  index: number
}) {
  const isLocal = result.kind === "local"
  const counts = result.counts
  const hasData =
    isLocal &&
    counts &&
    (counts.benchmarks > 0 || counts.presets > 0 || counts.comments > 0)

  return (
    <motion.article
      layout
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.3, delay: index * 0.02 }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className="group relative bg-text/3 border border-border rounded-xl p-4 sm:p-5 transition-colors duration-200 hover:border-text/30 hover:bg-text/[0.06] cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-text/20 focus-within:ring-offset-2 focus-within:ring-offset-background"
      title={isLocal
        ? "Click to view game details, benchmarks, and settings"
        : "Click to add this game to DeckyVault and view its page"
      }
    >
      {/* Full-card click target */}
      <div
        className="absolute inset-0 after:content-[''] after:absolute after:inset-0"
        onClick={() => onClick(result)}
      />

      <div className="flex gap-4 sm:gap-5">
        {/* Cover */}
        <motion.div
          className="relative w-20 sm:w-24 md:w-28 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-text/10 shadow-sm"
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.2 }}
        >
          <GameCover image={result.image} tinyImage={result.tinyImage} title={result.title} />
        </motion.div>

        {/* Main Content */}
        <div className="flex flex-col min-w-0 flex-1">
          {/* Row 1: Title + metascore/price row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold text-text group-hover:text-primary transition-colors duration-200 truncate">
                  {result.title}
                </h3>
                {!isLocal && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-text/5 border border-border text-text/35 capitalize shrink-0">
                    Steam
                  </span>
                )}
                {isLocal && result.source !== "steam" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 capitalize shrink-0">
                    {result.source}
                  </span>
                )}
                {result.isRawPerformer && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-semibold shrink-0">
                    ⚡ RAW PERFORMER
                  </span>
                )}
                {result.isPoorPerformance && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold shrink-0">
                    ⚠ POOR PERFORMANCE
                  </span>
                )}
                {result.estimatedBatteryMin != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold shrink-0">
                    🔋 ~{Math.round(result.estimatedBatteryMin / 60)}h
                  </span>
                )}
              </div>
              {(result.developer || result.publisher) && (
                <p className="text-[11px] text-text/45 mt-0.5 truncate">
                  {result.developer}
                  {result.developer && result.publisher ? " · " : ""}
                  {result.publisher}
                </p>
              )}
            </div>

            {/* Metascore + Price row */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {result.metascore ? (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-semibold"
                  title={`Metascore: ${result.metascore}/100`}
                >
                  <TrendingUpIcon className="h-3 w-3" />
                  {result.metascore}
                </span>
              ) : null}
              <PriceTag price={result.price} />
            </div>
          </div>

          {/* Row 2: Description */}
          {result.description && (
            <p className="text-[11px] text-text/40 line-clamp-2 leading-relaxed mt-1.5">
              {result.description}
            </p>
          )}

          {/* Row 3: Genre tags + Platform icons + Controller */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
            {result.genres && result.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-text/5 border border-border text-text/35"
                  >
                    {genre}
                  </span>
                ))}
                {result.genres.length > 3 && (
                  <span className="text-[10px] text-text/25 self-center">
                    +{result.genres.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Platform icons — always show all 3, color if present */}
            <div className="flex items-center gap-1.5">
              <span title="Windows">
                <WindowsIcon
                  className={`h-3.5 w-3.5 ${result.platforms?.windows ? "text-blue-400" : "text-text/20"}`}
                />
              </span>
              <span title="macOS">
                <MacIcon
                  className={`h-3.5 w-3.5 ${result.platforms?.mac ? "text-text/60" : "text-text/20"}`}
                />
              </span>
              <span title="Linux">
                <LinuxIcon
                  className={`h-3.5 w-3.5 ${result.platforms?.linux ? "text-yellow-500" : "text-text/20"}`}
                />
              </span>
            </div>

            {result.controllerSupport && (
              <span
                className="text-[10px] text-text/25 flex items-center gap-1"
                title="Full controller support"
              >
                <Gamepad2Icon className="h-3 w-3" />
                Controller
              </span>
            )}
          </div>

          {/* Row 4: Stats row */}
          <div className="flex flex-wrap items-center gap-3 mt-2.5">
            {hasData ? (
              <>
                {counts!.benchmarks > 0 && (
                  <StatBadge
                    icon={TrendingUpIcon}
                    count={counts!.benchmarks}
                    label="Benchmarks"
                  />
                )}
                {counts!.presets > 0 && (
                  <StatBadge
                    icon={SettingsIcon}
                    count={counts!.presets}
                    label="Presets"
                  />
                )}
                {counts!.comments > 0 && (
                  <StatBadge
                    icon={MessageSquareIcon}
                    count={counts!.comments}
                    label="Comments"
                  />
                )}
              </>
            ) : isLocal ? (
              <span className="text-[11px] text-text/30 italic">
                No data yet — be the first to contribute
              </span>
            ) : (
              <div className="flex flex-col items-start gap-1.5 w-full sm:w-auto">
                <a
                  href={`https://store.steampowered.com/app/${result.appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1b2838] border border-[#2a475e] text-[#c6d4df] text-[11px] hover:bg-[#2a475e] transition-colors w-full cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open store page on Steam"
                >
                  <FaSteam className="h-3 w-3" />
                  Steam
                  <ExternalLinkIcon className="h-2.5 w-2.5 opacity-60" />
                </a>
                <a
                  href={`https://www.protondb.com/app/${result.appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] hover:bg-purple-500/20 transition-colors w-full cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                  title="View Proton compatibility on ProtonDB"
                >
                  <SparklesIcon className="h-3 w-3" />
                  ProtonDB
                  <ExternalLinkIcon className="h-2.5 w-2.5 opacity-60" />
                </a>
                <a
                  href={`https://steamdb.info/app/${result.appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] hover:bg-blue-500/20 transition-colors w-full cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                  title="View app details on SteamDB"
                >
                  <DatabaseIcon className="h-3 w-3" />
                  SteamDB
                  <ExternalLinkIcon className="h-2.5 w-2.5 opacity-60" />
                </a>
              </div>
            )}
          </div>

          {/* Row 5: Anti-cheat info */}
          {result.platformSupport?.antiCheatRelevant && (
            <div className="mt-2">
              <span className="text-[10px] text-text/30">
                Anti-cheat: {result.platformSupport.antiCheatName || "Unknown"}
                <span className="text-text/20">
                  {" "}— {result.platformSupport.antiCheatStatus}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Right Panel — Desktop Only */}
        <div className="hidden md:flex flex-col items-end justify-center gap-2.5 shrink-0 min-w-[120px]">
          {/* Deck Status */}
          <DataField
            label="Deck"
            value={result.platformSupport ? protonLabel(result.platformSupport.protonStatus) : "—"}
            color={result.platformSupport ? protonColor(result.platformSupport.protonStatus) : undefined}
          />

          {/* Best FPS */}
          <DataField
            label="Best FPS"
            value={result.bestFps != null ? String(Math.round(result.bestFps)) : "—"}
            bar={result.bestFps != null}
            color={result.bestFps != null && result.bestFps >= 60 ? "text-green-400" : undefined}
          />

          {/* Battery Estimate */}
          {result.estimatedBatteryMin != null && (
            <DataField
              label="Battery"
              value={`~${Math.round(result.estimatedBatteryMin / 60)}h`}
            />
          )}

          {/* Version */}
          <DataField
            label="Version"
            value={result.latestVersion ?? "—"}
          />

          {/* Playability badge */}
          {result.playabilityStatus && (
            <PlayabilityBadge status={result.playabilityStatus} compact />
          )}

          {/* Anti-cheat badge */}
          {result.antiCheatRelevant && result.antiCheatStatus === "unsupported" && (
            <AntiCheatBadge
              antiCheatRelevant={true}
              antiCheatStatus={result.antiCheatStatus}
              antiCheatName={result.antiCheatName}
              compact
            />
          )}

          {/* Steam review score */}
          {result.steamReviewScore != null && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-400">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {result.steamReviewScore}% Positive
            </span>
          )}
        </div>
      </div>
    </motion.article>
  )
}

function DataField({
  label,
  value,
  bar,
  color,
}: {
  label: string
  value: string
  bar?: boolean
  color?: string
}) {
  return (
    <div className="flex flex-col items-end gap-1 w-full">
      <span className="text-[10px] text-text/30 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-2 w-full justify-end">
        {bar && (
          <div className="w-14 h-1.5 rounded-full bg-text/5 overflow-hidden">
            <div className="h-full w-0 rounded-full bg-primary/40" />
          </div>
        )}
        <span className={`text-xs tabular-nums ${color || "text-text/25"}`}>
          {value}
        </span>
      </div>
    </div>
  )
}

function protonLabel(status: string): string {
  const map: Record<string, string> = {
    native: "Native",
    proton: "Proton",
    unsupported: "Unsupported",
    unknown: "Unknown",
  }
  return map[status] || status
}

function protonColor(status: string): string {
  const map: Record<string, string> = {
    native: "text-green-400",
    proton: "text-blue-400",
    unsupported: "text-red-400",
    unknown: "text-text/25",
  }
  return map[status] || "text-text/25"
}

function GameCover({ image, tinyImage, title }: { image: string | null; tinyImage?: string | null; title: string }) {
  const [src, setSrc] = useState(image)
  const [fallbackStage, setFallbackStage] = useState(0)

  const handleError = () => {
    if (fallbackStage === 0 && tinyImage) {
      setFallbackStage(1)
      setSrc(tinyImage)
    } else {
      setFallbackStage(2)
      setSrc(null)
    }
  }

  if (src) {
    return (
      <Image
        src={src}
        alt={title}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 80px, 112px"
        onError={handleError}
      />
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <Gamepad2Icon className="h-6 w-6 text-text/20" />
    </div>
  )
}

function PriceTag({
  price,
}: {
  price?: { currency: string; initial: number; final: number } | null
}) {
  if (!price) {
    return null
  }

  // Price is 0 and initial is 0 → legitimately free-to-play
  if (price.initial === 0 && price.final === 0) {
    return (
      <span className="px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-medium">
        Free
      </span>
    )
  }

  // Price is 0 but initial > 0 → promotional free (free weekend etc.)
  if (price.final === 0 && price.initial > 0) {
    return (
      <span
        className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium"
        title="Currently free — may be a promotional event"
      >
        Free*
      </span>
    )
  }

  // Normal paid game
  const isDiscounted = price.final < price.initial
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
  })

  return (
    <span className="inline-flex items-center gap-1.5">
      {isDiscounted && (
        <span className="text-[10px] text-text/30 line-through">
          {fmt.format(price.initial / 100)}
        </span>
      )}
      <span
        className="px-2 py-0.5 rounded-md bg-text/5 border border-border text-text/60 text-[11px] font-medium"
        title={isDiscounted ? "Discounted price" : "Current price"}
      >
        {fmt.format(price.final / 100)}
      </span>
    </span>
  )
}

function StatBadge({
  icon: Icon,
  count,
  label,
}: {
  icon: React.ElementType
  count: number
  label: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-text/50"
      title={`${count} ${label.toLowerCase()}`}
    >
      <Icon className="h-3 w-3 text-text/30" />
      <span className="tabular-nums">{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}
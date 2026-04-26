"use client"

import { useCallback, useState, useEffect, useMemo, useRef } from "react"
import Image from "next/image"
import {
    Gamepad2Icon,
    MessageSquareIcon,
    SettingsIcon,
    TrendingUpIcon,
    ExternalLinkIcon,
    ClockIcon,
    SparklesIcon,
    DatabaseIcon,
    Plus,
} from "lucide-react"
import Link from "next/link"
import { useSession } from "@/lib/auth-client"
import { FaSteam } from "react-icons/fa"
import { motion } from "motion/react"

import { BookmarkButton } from "@/components/saved-games/bookmark-button"

// Chart imports
import { HistoricalAreaChart } from "@/components/charts/HistoricalAreaChart"
import { UpscalerBarChart } from "@/components/charts/UpscalerBarChart"
import { FpsBoxplot } from "@/components/charts/FpsBoxplot"
import { FpsRangeChart } from "@/components/charts/FpsRangeChart"
import { DeviceDonut } from "@/components/charts/DeviceDonut"
import { TrustBar } from "@/components/charts/TrustBar"

// Types
interface Game {
    id: string
    steamAppId: number | null
    title: string
    description: string | null
    developer: string | null
    publisher: string | null
    genres: string[] | null
    headerImage: string | null
    capsuleImage: string | null
    storeUrl: string | null
    source: string
    lastSync: string | null
    syncStatus: string | null
    createdAt: string
    metascore?: number | null
    onlineMultiplayerStatus?: string | null
}

interface Counts {
    benchmarks: number
    presets: number
    comments: number
}

interface PlatformSupport {
    id: string
    gameId: string
    hardwareSlug: string
    isSupported: boolean
    protonStatus: string
}

interface Preset {
    id: string
    name: string
    description: string | null
    hardwareSlug: string
    hardwareName: string
    upvotes: number
    settingsCount: number
    fpsAvg: number | null
    fpsLow: number | null
    fpsHigh: number | null
    fsrVersion: string | null
    frameGenMethod: string | null
    protonVersion: string | null
    osVersion: string | null
    createdAt: string
}

interface StatsResponse {
    summary: {
        totalEntries: number
        avgFps: number
        bestDevice: string
        verifiedCount: number
        versionCount: number
    }
    isRawPerformer: boolean
    boxplot: Array<{
        hardwareSlug: string
        hardwareName: string
        min: number
        q1: number
        median: number
        q3: number
        max: number
    }>
    historical: Array<{
        period: string
        entries: Array<{
            hardwareSlug: string
            avgFps: number
            count: number
        }>
    }>
    upscalerStats: Array<{
        fsrVersion: string
        frameGenMethod: string
        hardwareSlug: string
        avgFps: number
        count: number
    }>
    fpsRange: Array<{
        id: string
        hardwareSlug: string
        fpsLow: number
        fpsAvg: number
        fpsHigh: number
        isRawPerformer: boolean
    }>
    deviceBreakdown: Array<{
        hardwareSlug: string
        hardwareName: string
        count: number
    }>
    trust: Array<{
        id: string
        hardwareSlug: string
        upvotes: number
        downvotes: number
        verifiedAt: string | null
        userNotes: string | null
        createdAt: string
    }>
    filterOptions: {
        protonVersions: string[]
        osVersions: string[]
    }
}

interface Props {
    game: Game
    counts: Counts
    platformSupport: PlatformSupport[]
    presets: Preset[]
    gameId: string
}

const FSR_OPTIONS = ["Any", "None", "FSR1", "FSR2", "FSR3"]
const FRAMEGEN_OPTIONS = ["Any", "None", "FSR FG", "DLSS FG"]

function formatDate(value: string | null): string {
    if (!value) return "—"
    return new Date(value).toLocaleDateString()
}

function isRawPerformerPreset(preset: Preset): boolean {
    return (
        preset.fpsAvg !== null &&
        preset.fpsAvg >= 60 &&
        preset.fsrVersion === "none" &&
        preset.frameGenMethod === "none"
    )
}

function getFpsColor(preset: Preset): string {
    if (preset.fpsAvg === null) return "text-text/60"
    if (isRawPerformerPreset(preset)) return "text-green-400"
    if (preset.frameGenMethod && preset.frameGenMethod !== "none") {
        if (preset.frameGenMethod === "dlss_fg") return "text-blue-400"
        return "text-orange-400"
    }
    if (preset.fsrVersion && preset.fsrVersion !== "none")
        return "text-orange-400"
    return "text-text/60"
}

export function GamePageClient({
    game,
    counts,
    platformSupport,
    presets,
    gameId,
}: Props) {
    const { data: session } = useSession()
    const [imgError, setImgError] = useState(false)
    const [stats, setStats] = useState<StatsResponse | null>(null)
    const [selectedDevices, setSelectedDevices] = useState<string[]>([])
    const [filters, setFilters] = useState({
        proton: "all",
        os: "all",
        fsr: "all",
        frameGen: "all",
    })
    const [loading, setLoading] = useState(true)

    const handleImgError = useCallback(() => setImgError(true), [])

    // Fetch stats on mount
    useEffect(() => {
        let cancelled = false
        async function fetchStats() {
            setLoading(true)
            try {
                const res = await fetch(`/api/games/${gameId}/stats`)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                if (!cancelled) setStats(data)
            } catch (err) {
                console.error("Failed to fetch stats:", err)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchStats()
        return () => {
            cancelled = true
        }
    }, [gameId])

    // Initialize selected devices when stats load
    const didInitDevices = useRef(false)
    useEffect(() => {
        if (stats && !didInitDevices.current) {
            didInitDevices.current = true
            const slugs = stats.deviceBreakdown.map((d) => d.hardwareSlug)
            queueMicrotask(() => setSelectedDevices(slugs))
        }
    }, [stats])

    // Filtered stats
    const filteredStats = useMemo(() => {
        if (!stats) return null

        const deviceSet = new Set(selectedDevices)

        const filterByDevice = <T extends { hardwareSlug: string }>(arr: T[]) =>
            arr.filter((item) => deviceSet.has(item.hardwareSlug))

        const filterUpscaler = (arr: StatsResponse["upscalerStats"]) =>
            arr.filter((item) => {
                if (!deviceSet.has(item.hardwareSlug)) return false
                if (filters.fsr !== "all" && item.fsrVersion !== filters.fsr)
                    return false
                if (
                    filters.frameGen !== "all" &&
                    item.frameGenMethod !== filters.frameGen
                )
                    return false
                return true
            })

        return {
            ...stats,
            boxplot: filterByDevice(stats.boxplot),
            historical: stats.historical
                .map((h) => ({
                    ...h,
                    entries: h.entries.filter((e) =>
                        deviceSet.has(e.hardwareSlug),
                    ),
                }))
                .filter((h) => h.entries.length > 0),
            upscalerStats: filterUpscaler(stats.upscalerStats),
            fpsRange: filterByDevice(stats.fpsRange),
            deviceBreakdown: filterByDevice(stats.deviceBreakdown),
            trust: filterByDevice(stats.trust),
        }
    }, [stats, selectedDevices, filters])

    // Filtered presets
    const filteredPresets = useMemo(() => {
        return presets.filter((p) => {
            if (
                selectedDevices.length > 0 &&
                !selectedDevices.includes(p.hardwareSlug)
            )
                return false
            if (filters.proton !== "all" && p.protonVersion !== filters.proton)
                return false
            if (filters.os !== "all" && p.osVersion !== filters.os) return false
            if (filters.fsr !== "all" && p.fsrVersion !== filters.fsr)
                return false
            if (
                filters.frameGen !== "all" &&
                p.frameGenMethod !== filters.frameGen
            )
                return false
            return true
        })
    }, [presets, selectedDevices, filters])

    const coverImage = game.capsuleImage || game.headerImage

    const protonDbUrl = game.steamAppId
        ? `https://www.protondb.com/app/${game.steamAppId}`
        : null
    const steamDbUrl = game.steamAppId
        ? `https://steamdb.info/app/${game.steamAppId}`
        : null

    const toggleDevice = useCallback((slug: string) => {
        setSelectedDevices((prev) =>
            prev.includes(slug)
                ? prev.filter((s) => s !== slug)
                : [...prev, slug],
        )
    }, [])

    return (
        <section className='w-full flex flex-col gap-8 pb-16'>
            {/* Section 1: Hero Header */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className='px-4 md:px-[10svw] pt-6'
            >
                <div className='max-w-7xl mx-auto flex gap-4 sm:gap-6'>
                    {/* Cover image */}
                    <div className='relative shrink-0 aspect-2/3 w-28 sm:w-32 md:w-36 rounded-lg overflow-hidden border border-border bg-text/5'>
                        {coverImage && !imgError ? (
                            <Image
                                src={coverImage}
                                alt={game.title}
                                fill
                                className='object-cover'
                                priority
                                onError={handleImgError}
                            />
                        ) : (
                            <div className='w-full h-full flex items-center justify-center'>
                                <Gamepad2Icon className='h-10 w-10 text-text/20' />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className='flex flex-col gap-2 min-w-0'>
                        {/* Title row */}
                        <div className='flex flex-wrap items-center gap-2'>
                            <h1 className='text-xl sm:text-2xl md:text-3xl font-bold truncate'>
                                {game.title}
                            </h1>
                            {stats?.isRawPerformer && (
                                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-semibold'>
                                    <SparklesIcon className='h-3 w-3' />
                                    Raw Performer
                                </span>
                            )}
                        </div>

                        {/* Subtitle */}
                        <div className='flex flex-wrap items-center gap-2 text-sm text-text/70'>
                            {game.developer && <span>{game.developer}</span>}
                            {game.developer && game.publisher && (
                                <span className='text-text/40'>·</span>
                            )}
                            {game.publisher && <span>{game.publisher}</span>}
                            {game.genres && game.genres.length > 0 && (
                                <>
                                    <span className='text-text/40'>·</span>
                                    <span className='text-text/60'>
                                        {game.genres.slice(0, 3).join(", ")}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Stats badges */}
                        <div className='flex flex-wrap items-center gap-2 mt-1'>
                            <Badge
                                icon={TrendingUpIcon}
                                value={counts.benchmarks}
                                label='Benchmarks'
                            />
                            <Badge
                                icon={SettingsIcon}
                                value={counts.presets}
                                label='Presets'
                            />
                            <Badge
                                icon={MessageSquareIcon}
                                value={counts.comments}
                                label='Comments'
                            />
                            {game.metascore !== undefined &&
                                game.metascore !== null && (
                                    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold'>
                                        ★ {game.metascore}
                                    </span>
                                )}
                            <BookmarkButton gameId={game.id} />
                            {session && (
                                <Link
                                    href={`/game/${game.id}/submit`}
                                    className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer'
                                >
                                    <Plus className='h-4 w-4' />
                                    Add Benchmark
                                </Link>
                            )}
                        </div>

                        {/* External links */}
                        <div className='flex flex-wrap items-center gap-3 mt-1'>
                            {game.storeUrl && (
                                <a
                                    href={game.storeUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='inline-flex items-center gap-1 text-xs text-text/60 hover:text-primary transition-colors cursor-pointer'
                                >
                                    <FaSteam className='h-3.5 w-3.5' />
                                    Steam
                                    <ExternalLinkIcon className='h-3 w-3' />
                                </a>
                            )}
                            {protonDbUrl && (
                                <a
                                    href={protonDbUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='inline-flex items-center gap-1 text-xs text-text/60 hover:text-primary transition-colors cursor-pointer'
                                >
                                    ProtonDB
                                    <ExternalLinkIcon className='h-3 w-3' />
                                </a>
                            )}
                            {steamDbUrl && (
                                <a
                                    href={steamDbUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='inline-flex items-center gap-1 text-xs text-text/60 hover:text-primary transition-colors cursor-pointer'
                                >
                                    SteamDB
                                    <ExternalLinkIcon className='h-3 w-3' />
                                </a>
                            )}
                        </div>

                        {/* DB stats row */}
                        {stats && (
                            <div className='flex flex-wrap items-center gap-3 mt-1 text-xs text-text/50'>
                                <span className='inline-flex items-center gap-1'>
                                    <DatabaseIcon className='h-3 w-3' />
                                    {stats.summary.versionCount} versions
                                </span>
                                <span>·</span>
                                <span className='inline-flex items-center gap-1'>
                                    <SparklesIcon className='h-3 w-3' />
                                    {stats.summary.verifiedCount} verified
                                </span>
                                {game.lastSync && (
                                    <>
                                        <span>·</span>
                                        <span className='inline-flex items-center gap-1'>
                                            <ClockIcon className='h-3 w-3' />
                                            Last sync{" "}
                                            {formatDate(game.lastSync)}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Section 2: Overview */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className='px-4 md:px-[10svw]'
            >
                <div className='max-w-7xl mx-auto flex flex-col md:flex-row gap-6'>
                    {/* Left: Description */}
                    <div className='flex-2'>
                        <h2 className='text-sm font-medium uppercase tracking-wider text-text/60 mb-3'>
                            About
                        </h2>
                        {game.description ? (
                            <p className='text-sm text-text/80 leading-relaxed whitespace-pre-line'>
                                {game.description}
                            </p>
                        ) : (
                            <p className='text-sm text-text/40 italic'>
                                No description available.
                            </p>
                        )}
                    </div>

                    {/* Right: Metadata grid */}
                    <div className='flex-1'>
                        <h2 className='text-sm font-medium uppercase tracking-wider text-text/60 mb-3'>
                            Details
                        </h2>
                        <div className='grid grid-cols-2 gap-3 text-sm'>
                            <MetaItem
                                label='Source'
                                value={game.source}
                            />
                            {game.steamAppId !== null && (
                                <MetaItem
                                    label='Steam AppID'
                                    value={String(game.steamAppId)}
                                />
                            )}
                            <MetaItem
                                label='Added'
                                value={formatDate(game.createdAt)}
                            />
                            <MetaItem
                                label='Last Sync'
                                value={formatDate(game.lastSync)}
                            />
                            {game.onlineMultiplayerStatus && (
                                <MetaItem
                                    label='Online Multiplayer'
                                    value={game.onlineMultiplayerStatus}
                                />
                            )}
                        </div>

                        {/* Platform Support */}
                        {platformSupport.length > 0 && (
                            <div className='mt-4'>
                                <h3 className='text-xs font-medium uppercase tracking-wider text-text/50 mb-2'>
                                    Platform Support
                                </h3>
                                <div className='flex flex-col gap-2'>
                                    {platformSupport.map((ps) => (
                                        <div
                                            key={ps.id}
                                            className='flex items-center justify-between p-2 rounded-md border border-border bg-text/3'
                                        >
                                            <span className='text-xs font-medium capitalize'>
                                                {ps.hardwareSlug.replace(
                                                    /-/g,
                                                    " ",
                                                )}
                                            </span>
                                            <div className='flex items-center gap-2'>
                                                <span
                                                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                                        ps.isSupported
                                                            ? "bg-green-500/20 text-green-400"
                                                            : "bg-red-500/20 text-red-400"
                                                    }`}
                                                >
                                                    {ps.isSupported
                                                        ? "Supported"
                                                        : "Unsupported"}
                                                </span>
                                                <span className='text-[10px] text-text/50 capitalize'>
                                                    {ps.protonStatus}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Section 3: Device Selector + Filters */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className='px-4 md:px-[10svw]'
            >
                <div className='max-w-7xl mx-auto flex flex-col gap-4'>
                    {/* Device ribbon */}
                    {stats && stats.deviceBreakdown.length > 0 && (
                        <div className='flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide'>
                            {stats.deviceBreakdown.map((device) => {
                                const active = selectedDevices.includes(
                                    device.hardwareSlug,
                                )
                                return (
                                    <button
                                        key={device.hardwareSlug}
                                        onClick={() =>
                                            toggleDevice(device.hardwareSlug)
                                        }
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                                            active
                                                ? "bg-primary/20 border-primary text-primary"
                                                : "bg-transparent border-border text-text/60 hover:text-text/80"
                                        }`}
                                    >
                                        {device.hardwareName}
                                        <span className='ml-1 text-text/40'>
                                            ({device.count})
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Fine filters */}
                    <div className='flex flex-wrap items-center gap-2'>
                        <FilterSelect
                            label='Proton Version'
                            value={filters.proton}
                            options={[
                                "all",
                                ...(stats?.filterOptions.protonVersions ?? []),
                            ]}
                            onChange={(v) =>
                                setFilters((f) => ({ ...f, proton: v }))
                            }
                        />
                        <FilterSelect
                            label='SteamOS Version'
                            value={filters.os}
                            options={[
                                "all",
                                ...(stats?.filterOptions.osVersions ?? []),
                            ]}
                            onChange={(v) =>
                                setFilters((f) => ({ ...f, os: v }))
                            }
                        />
                        <FilterSelect
                            label='FSR Version'
                            value={filters.fsr}
                            options={FSR_OPTIONS.map((o) => o.toLowerCase())}
                            onChange={(v) =>
                                setFilters((f) => ({ ...f, fsr: v }))
                            }
                        />
                        <FilterSelect
                            label='Frame Gen Method'
                            value={filters.frameGen}
                            options={FRAMEGEN_OPTIONS.map((o) =>
                                o.toLowerCase().replace(" ", "_"),
                            )}
                            onChange={(v) =>
                                setFilters((f) => ({ ...f, frameGen: v }))
                            }
                        />
                    </div>
                </div>
            </motion.div>

            {/* Section 4: Statistics Dashboard */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className='px-4 md:px-[10svw]'
            >
                <div className='max-w-7xl mx-auto flex flex-col gap-6'>
                    {/* Row 1 — Featured */}
                    {filteredStats && (
                        <div className='flex flex-col lg:flex-row gap-4'>
                            <div className='flex-3 rounded-xl border border-border bg-text/3 p-4'>
                                <h3 className='text-sm font-medium text-text/80 mb-2'>
                                    Historical Performance
                                </h3>
                                {filteredStats.historical.length > 0 ? (
                                    <HistoricalAreaChart
                                        data={filteredStats.historical}
                                    />
                                ) : (
                                    <div className='h-70 flex items-center justify-center text-sm text-text/40'>
                                        No historical data
                                    </div>
                                )}
                            </div>
                            <div className='flex-1 flex flex-col gap-3'>
                                <StatCard
                                    label='Overall Avg FPS'
                                    value={
                                        filteredStats.summary.avgFps?.toFixed(
                                            1,
                                        ) ?? "—"
                                    }
                                    icon={TrendingUpIcon}
                                />
                                <StatCard
                                    label='Best Device'
                                    value={
                                        filteredStats.summary.bestDevice ?? "—"
                                    }
                                    icon={Gamepad2Icon}
                                />
                                <StatCard
                                    label='Total Entries'
                                    value={String(
                                        filteredStats.summary.totalEntries,
                                    )}
                                    icon={DatabaseIcon}
                                />
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div className='flex items-center justify-center py-12 text-sm text-text/40'>
                            <ClockIcon className='h-4 w-4 animate-spin mr-2' />
                            Loading statistics...
                        </div>
                    )}

                    {/* Row 2 — Upscaler Bar */}
                    {filteredStats &&
                        filteredStats.upscalerStats.length > 0 && (
                            <div className='rounded-xl border border-border bg-text/3 p-4'>
                                <h3 className='text-sm font-medium text-text/80 mb-2'>
                                    Upscaler Performance
                                </h3>
                                <UpscalerBarChart
                                    data={filteredStats.upscalerStats}
                                />
                            </div>
                        )}

                    {/* Row 3 — 3-column grid */}
                    {filteredStats && (
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            {filteredStats.boxplot.length > 0 && (
                                <div className='rounded-xl border border-border bg-text/3 p-4'>
                                    <h3 className='text-sm font-medium text-text/80 mb-2'>
                                        FPS Distribution
                                    </h3>
                                    <FpsBoxplot data={filteredStats.boxplot} />
                                </div>
                            )}
                            {filteredStats.fpsRange.length > 0 && (
                                <div className='rounded-xl border border-border bg-text/3 p-4'>
                                    <h3 className='text-sm font-medium text-text/80 mb-2'>
                                        FPS Range
                                    </h3>
                                    <FpsRangeChart
                                        data={filteredStats.fpsRange}
                                    />
                                </div>
                            )}
                            {filteredStats.deviceBreakdown.length > 0 && (
                                <div className='rounded-xl border border-border bg-text/3 p-4'>
                                    <h3 className='text-sm font-medium text-text/80 mb-2'>
                                        Device Breakdown
                                    </h3>
                                    <DeviceDonut
                                        data={filteredStats.deviceBreakdown}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Row 4 — Trust Bar */}
                    {filteredStats && filteredStats.trust.length > 0 && (
                        <div className='rounded-xl border border-border bg-text/3 p-4'>
                            <h3 className='text-sm font-medium text-text/80 mb-2'>
                                Community Trust
                            </h3>
                            <TrustBar data={filteredStats.trust} />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Section 5: Community Presets */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className='px-4 md:px-[10svw]'
            >
                <div className='max-w-7xl mx-auto flex flex-col gap-4'>
                    <div className='flex items-center justify-between'>
                        <h2 className='text-lg font-semibold'>
                            Community Presets
                        </h2>
                        <span className='text-xs text-text/50'>
                            {filteredPresets.length} preset
                            {filteredPresets.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {filteredPresets.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-border bg-text/2'>
                            <SettingsIcon className='h-10 w-10 text-text/20' />
                            <p className='text-sm text-text/40'>
                                No presets match the selected filters
                            </p>
                        </div>
                    ) : (
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                            {filteredPresets.map((preset) => {
                                const raw = isRawPerformerPreset(preset)
                                const fpsColor = getFpsColor(preset)
                                return (
                                    <div
                                        key={preset.id}
                                        className={`flex flex-col gap-3 p-4 rounded-xl border transition-colors ${
                                            raw
                                                ? "border-green-500/30 bg-green-500/5"
                                                : "border-border bg-text/3"
                                        }`}
                                    >
                                        {/* Header */}
                                        <div className='flex items-start justify-between gap-2'>
                                            <div className='min-w-0'>
                                                <div className='flex items-center gap-2'>
                                                    <h3 className='font-semibold text-sm truncate'>
                                                        {preset.name}
                                                    </h3>
                                                    {raw && (
                                                        <span className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-semibold'>
                                                            <SparklesIcon className='h-2.5 w-2.5' />
                                                            Raw
                                                        </span>
                                                    )}
                                                </div>
                                                <p className='text-xs text-text/50 mt-0.5'>
                                                    {preset.hardwareName}
                                                </p>
                                            </div>
                                            <div className='flex items-center gap-1 text-xs text-text/60 shrink-0'>
                                                <TrendingUpIcon className='h-3 w-3' />
                                                {preset.upvotes}
                                            </div>
                                        </div>

                                        {/* Settings count */}
                                        <div className='text-xs text-text/50'>
                                            {preset.settingsCount} settings
                                        </div>

                                        {/* FPS */}
                                        {preset.fpsAvg !== null && (
                                            <div
                                                className={`text-sm tabular-nums ${fpsColor}`}
                                            >
                                                <span className='font-semibold'>
                                                    {preset.fpsAvg}
                                                </span>
                                                <span className='text-text/40'>
                                                    {" "}
                                                    avg
                                                </span>
                                                {preset.fpsLow !== null && (
                                                    <span className='text-text/40'>
                                                        {" "}
                                                        ({preset.fpsLow}–
                                                        {preset.fpsHigh})
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Technology tags */}
                                        <div className='flex flex-wrap items-center gap-1.5'>
                                            {preset.fsrVersion &&
                                                preset.fsrVersion !==
                                                    "none" && (
                                                    <span className='px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20'>
                                                        {preset.fsrVersion.toUpperCase()}
                                                    </span>
                                                )}
                                            {preset.frameGenMethod &&
                                                preset.frameGenMethod !==
                                                    "none" && (
                                                    <span
                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                                            preset.frameGenMethod ===
                                                            "dlss_fg"
                                                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                                : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                                        }`}
                                                    >
                                                        {preset.frameGenMethod ===
                                                        "fsr_fg"
                                                            ? "FSR FG"
                                                            : preset.frameGenMethod ===
                                                                "dlss_fg"
                                                              ? "DLSS FG"
                                                              : preset.frameGenMethod}
                                                    </span>
                                                )}
                                        </div>

                                        {/* Proton + OS */}
                                        <div className='flex flex-wrap items-center gap-2 text-[10px] text-text/40'>
                                            {preset.protonVersion && (
                                                <span>
                                                    Proton{" "}
                                                    {preset.protonVersion}
                                                </span>
                                            )}
                                            {preset.osVersion && (
                                                <span>
                                                    SteamOS {preset.osVersion}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </section>
    )
}

function Badge({
    icon: Icon,
    value,
    label,
}: {
    icon: React.ElementType
    value: number
    label: string
}) {
    return (
        <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-semibold'>
            <Icon className='h-3 w-3' />
            {value} {label}
        </span>
    )
}

function MetaItem({ label, value }: { label: string; value: string }) {
    return (
        <div className='flex flex-col gap-1'>
            <span className='text-[10px] text-text/50 uppercase tracking-wider'>
                {label}
            </span>
            <span className='text-text/80 text-sm'>{value}</span>
        </div>
    )
}

function StatCard({
    label,
    value,
    icon: Icon,
}: {
    label: string
    value: string
    icon: React.ElementType
}) {
    return (
        <div className='flex items-center gap-3 p-4 rounded-xl border border-border bg-text/3'>
            <div className='flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary'>
                <Icon className='h-4 w-4' />
            </div>
            <div className='flex flex-col'>
                <span className='text-xs text-text/50'>{label}</span>
                <span className='text-lg font-semibold tabular-nums'>
                    {value}
                </span>
            </div>
        </div>
    )
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: string
    options: string[]
    onChange: (value: string) => void
}) {
    return (
        <div className='flex items-center gap-1.5'>
            <label className='text-xs text-text/50 shrink-0'>{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className='text-xs bg-background border border-border rounded-md px-2 py-1 text-text/80 focus:outline-none focus:border-primary min-w-25'
            >
                {options.map((opt) => (
                    <option
                        key={opt}
                        value={opt}
                    >
                        {opt === "all" ? "Any" : opt}
                    </option>
                ))}
            </select>
        </div>
    )
}

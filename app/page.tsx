"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
    Gamepad2Icon,
    SearchIcon,
    TrendingUpIcon,
    GaugeIcon,
    ClockIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { PlayabilityBadge } from "@/components/playability-badge"
import { cn } from "@/lib/utils"

interface GameCard {
    id: string
    title: string
    capsule_image: string | null
    header_image: string | null
    playability_status?: string | null
    activity_score?: number
    benchmark_count?: number
    comment_count?: number
    upvote_count?: number
    avg_fps?: number
    report_count?: number
    release_date?: string | null
    created_at?: string | null
}

interface SectionData {
    recentBenchmarks: GameCard[]
    trending: GameCard[]
    mostTested: GameCard[]
    onSale: SaleGameCard[]
}

interface SaleGameCard extends GameCard {
    price_current?: number
    price_initial?: number
    price_currency?: string
    steam_review_score?: number
    best_fps?: number
}

function SkeletonSections() {
    return (
        <>
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className='space-y-3'
                >
                    <div className='h-5 w-48 bg-text/5 rounded animate-pulse' />
                    <div className='flex gap-3 overflow-x-auto pb-2'>
                        {[1, 2, 3, 4].map((j) => (
                            <div
                                key={j}
                                className='shrink-0 w-36 sm:w-44 rounded-xl bg-text/3 border border-border animate-pulse'
                            >
                                <div className='aspect-[2/3] bg-text/5 rounded-t-xl' />
                                <div className='p-3 space-y-2'>
                                    <div className='h-3 bg-text/5 rounded w-3/4' />
                                    <div className='h-2 bg-text/5 rounded w-1/2' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    )
}

function GameSection({
    title,
    icon: Icon,
    games,
    statKey,
    statLabel,
    statFormatter,
    accentColor = "text-text/50",
    muted = false,
}: {
    title: string
    icon: React.ElementType
    games: GameCard[]
    statKey: string
    statLabel: string
    statFormatter?: (v: unknown) => string
    accentColor?: string
    muted?: boolean
}) {
    const router = useRouter()

    const formatStat = (v: unknown): string => {
        if (statFormatter) return statFormatter(v)
        if (typeof v === "number") return `${Math.round(v)} ${statLabel}`
        return `${v} ${statLabel}`
    }

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4 }}
            className={muted ? "opacity-70" : ""}
        >
            <div className='flex items-center gap-2 mb-4'>
                <div className='border-l-2 border-primary pl-3'>
                    <div className='flex items-center gap-2'>
                        <Icon className={`h-4 w-4 ${accentColor}`} />
                        <h2 className='text-sm font-semibold text-text/80'>
                            {title}
                        </h2>
                    </div>
                </div>
            </div>

            <div className='flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none'>
                {games.map((game, idx) => (
                    <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className='group shrink-0 w-36 sm:w-44 rounded-xl bg-text/3 border border-border hover:border-text/30 hover:bg-text/6 transition-colors cursor-pointer overflow-hidden'
                        onClick={() => router.push(`/game/${game.id}?sync=1`)}
                    >
                        <div className='relative aspect-2/3 bg-text/10 overflow-hidden'>
                            {game.capsule_image ? (
                                <Image
                                    src={game.capsule_image}
                                    alt={game.title}
                                    fill
                                    className='object-cover rounded-xl group-hover:scale-[0.97] transition-transform duration-300'
                                    sizes='(max-width: 640px) 144px, 176px'
                                />
                            ) : (
                                <div className='w-full h-full flex items-center justify-center'>
                                    <Gamepad2Icon className='h-8 w-8 text-text/15' />
                                </div>
                            )}
                            {/* Playability badge pinned at bottom of image */}
                            {game.playability_status &&
                                game.playability_status !== "unknown" && (
                                    <div className='absolute bottom-1.5 left-1.5 right-1.5'>
                                        <PlayabilityBadge
                                            status={game.playability_status as "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown" | null}
                                            compact
                                            showLabel
                                            className='text-[10px] px-1.5 py-0.5 w-full justify-center'
                                        />
                                    </div>
                                )}
                        </div>

                        <div className='p-2.5 space-y-1.5'>
                            <h3 className='text-xs font-semibold text-text line-clamp-2 leading-tight group-hover:text-primary transition-colors'>
                                {game.title}
                            </h3>

                            {/* Performance badges */}
                            {game.avg_fps !== undefined && game.avg_fps !== null && (
                                <div className='flex flex-wrap gap-1'>
                                    {game.avg_fps >= 60 ? (
                                        <span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-semibold leading-tight'>
                                            ⚡ RAW PERFORMER
                                        </span>
                                    ) : game.avg_fps < 30 ? (
                                        <span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-semibold leading-tight'>
                                            ⚠ POOR PERFORMANCE
                                        </span>
                                    ) : null}
                                    <span className='inline-flex items-center gap-0.5 text-[9px] text-text/50 font-medium'>
                                        {Math.round(game.avg_fps)}fps
                                    </span>
                                </div>
                            )}

                            <p
                                className={`text-[10px] ${accentColor} font-medium`}
                            >
                                {formatStat(
                                    (
                                        game as unknown as Record<
                                            string,
                                            unknown
                                        >
                                    )[statKey],
                                )}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    )
}

function SaleSection({
    games,
}: {
    games: SaleGameCard[]
}) {
    const router = useRouter()

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4 }}
        >
            <div className='flex items-center gap-2 mb-4'>
                <div className='border-l-2 border-green-500 pl-3'>
                    <div className='flex items-center gap-2'>
                        <span className="text-green-400 text-sm">💰</span>
                        <h2 className='text-sm font-semibold text-text/80'>
                            On Sale & Performing Well
                        </h2>
                    </div>
                </div>
            </div>

            <div className='flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none'>
                {games.map((game, idx) => {
                    const discountPct = game.price_initial && game.price_current
                        ? Math.round((1 - game.price_current / game.price_initial) * 100)
                        : 0

                    return (
                        <motion.div
                            key={game.id}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: idx * 0.05 }}
                            className='group shrink-0 w-36 sm:w-44 rounded-xl bg-text/3 border border-border hover:border-text/30 hover:bg-text/6 transition-colors cursor-pointer overflow-hidden'
                            onClick={() => router.push(`/game/${game.id}?sync=1`)}
                        >
                            <div className='relative aspect-2/3 bg-text/10 overflow-hidden'>
                                {game.capsule_image ? (
                                    <Image
                                        src={game.capsule_image}
                                        alt={game.title}
                                        fill
                                        className='object-cover rounded-xl group-hover:scale-[0.97] transition-transform duration-300'
                                        sizes='(max-width: 640px) 144px, 176px'
                                    />
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center'>
                                        <Gamepad2Icon className='h-8 w-8 text-text/15' />
                                    </div>
                                )}
                                {/* Discount badge */}
                                {discountPct > 0 && (
                                    <div className='absolute top-2 right-2 px-1.5 py-0.5 rounded bg-green-500 text-white text-[10px] font-bold'>
                                        -{discountPct}%
                                    </div>
                                )}
                                {game.playability_status &&
                                    game.playability_status !== "unknown" && (
                                        <div className='absolute bottom-1.5 left-1.5 right-1.5'>
                                            <PlayabilityBadge
                                                status={game.playability_status as "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown" | null}
                                                compact
                                                showLabel
                                                className='text-[10px] px-1.5 py-0.5 w-full justify-center'
                                            />
                                        </div>
                                    )}
                            </div>

                            <div className='p-2.5 space-y-1.5'>
                                <h3 className='text-xs font-semibold text-text line-clamp-2 leading-tight group-hover:text-primary transition-colors'>
                                    {game.title}
                                </h3>

                                {/* Pricing */}
                                <div className='flex items-center gap-1.5'>
                                    {game.price_current !== undefined && (
                                        <span className='text-xs font-bold text-green-400'>
                                            {game.price_currency === "USD" ? "$" : ""}{(game.price_current / 100).toFixed(2)}
                                        </span>
                                    )}
                                    {game.price_initial !== undefined && game.price_initial > (game.price_current ?? 0) && (
                                        <span className='text-[10px] text-text/30 line-through'>
                                            {(game.price_initial / 100).toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                {/* Performance badges */}
                                {game.best_fps !== undefined && game.best_fps !== null && (
                                    <div className='flex flex-wrap gap-1'>
                                        {game.best_fps >= 60 ? (
                                            <span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-semibold'>
                                                ⚡ RAW PERFORMER
                                            </span>
                                        ) : game.best_fps < 30 ? (
                                            <span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-semibold'>
                                                ⚠ POOR PERFORMANCE
                                            </span>
                                        ) : null}
                                        <span className='inline-flex items-center gap-0.5 text-[9px] text-text/50 font-medium'>
                                            {Math.round(game.best_fps)}fps
                                        </span>
                                    </div>
                                )}

                                {game.steam_review_score !== undefined && game.steam_review_score !== null && (
                                    <p className='text-[10px] text-blue-400 font-medium'>
                                        {game.steam_review_score}% positive
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Disclaimer */}
            <p className='text-[10px] text-text/20 mt-1 text-right'>
                Prices may vary. Data refreshes weekly.
            </p>
        </motion.section>
    )
}

export default function Landing() {
    const router = useRouter()
    const words = ["benchmarks", "settings", "reviews"]

    const [currentWord, setCurrentWord] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")

    // Landing section state
    const [sections, setSections] = useState<SectionData>({
        recentBenchmarks: [],
        trending: [],
        mostTested: [],
        onSale: [],
    })
    const [sectionsLoading, setSectionsLoading] = useState(true)

    // Animated words cycle — use useEffect with proper cleanup
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentWord((prev) => (prev + 1) % words.length)
        }, 2000)
        return () => clearInterval(interval)
    }, [words.length])

    // Fetch all 4 sections in parallel on mount
    useEffect(() => {
        let cancelled = false
        async function fetchSections() {
            try {
                const [recentBenchmarks, trending, mostTested, onSale] =
                    await Promise.all([
                        fetch("/api/dashboard/recent-benchmarks").then((r) =>
                            r.ok ? r.json() : [],
                        ),
                        fetch("/api/dashboard/trending").then((r) =>
                            r.ok ? r.json() : [],
                        ),
                        fetch("/api/dashboard/most-tested").then((r) =>
                            r.ok ? r.json() : [],
                        ),
                        fetch("/api/dashboard/on-sale").then((r) =>
                            r.ok ? r.json() : [],
                        ),
                    ])
                if (!cancelled) {
                    setSections({
                        recentBenchmarks: Array.isArray(recentBenchmarks) ? recentBenchmarks : [],
                        trending: Array.isArray(trending) ? trending : [],
                        mostTested: Array.isArray(mostTested) ? mostTested : [],
                        onSale: Array.isArray(onSale) ? onSale : [],
                    })
                }
            } catch {
                // Silently fail — sections are best-effort
            } finally {
                if (!cancelled) setSectionsLoading(false)
            }
        }
        fetchSections()
        return () => {
            cancelled = true
        }
    }, [])

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            sessionStorage.setItem("focusSearch", "true")
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearchSubmit()
        }
    }

    return (
        <>
            {/* ── Hero Section ── */}
            <section
                id='hero'
                className='w-full min-h-[70svh] mt-[10svh] flex flex-col items-center justify-center relative p-4'
            >
                <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='font-bold text-3xl md:text-5xl text-center flex flex-row gap-2 items-center justify-center'
                >
                    DeckyVault
                    <span className='border border-border text-xs md:text-base px-2 py-1 rounded-md bg-primary/10 font-medium'>
                        beta
                    </span>
                </motion.h1>
                <motion.h2
                    layout
                    initial={{
                        opacity: 0,
                    }}
                    animate={{ opacity: 0.8, transition: { delay: 0.5 } }}
                    className='mt-4 flex flex-row flex-wrap items-center justify-center gap-x-1 md:gap-x-2 text-base md:text-xl'
                >
                    {"Find your game".split(" ").map((word, index) => (
                        <motion.span
                            key={index}
                            className='text-center'
                        >
                            {word}
                        </motion.span>
                    ))}
                    <AnimatePresence
                        mode='wait'
                        initial={false}
                    >
                        <motion.span
                            key={currentWord}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className='text-primary font-bold'
                        >
                            {words[currentWord]}
                        </motion.span>
                    </AnimatePresence>
                </motion.h2>
                <AnimatePresence>
                    <motion.label
                        key='search-bar'
                        layoutId='search-bar'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className='mt-8 flex flex-row items-center gap-4 bg-text/5 px-2 py-2 rounded-md border border-border placeholder:text-text/60 group hover:border-border-active transition-colors focus-within:border-primary/80! focus-within:ring-2 focus-within:ring-primary/50! focus-within:ring-offset-2 focus-within:ring-offset-background cursor-text w-full max-w-md'
                    >
                        <Gamepad2Icon className='h-6 w-6 group-focus-within:stroke-accent transition-colors shrink-0' />
                        <input
                            type='text'
                            placeholder='search by game or appid...'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className='flex-1 outline-none bg-transparent text-xl min-w-0'
                        />
                        <motion.button
                            onClick={handleSearchSubmit}
                            whileTap={{ scale: 0.95 }}
                            className='text-sm flex flex-row gap-1 items-center bg-text text-background px-2 py-1 rounded-sm cursor-pointer hover:opacity-60 transition-opacity shrink-0'
                        >
                            <SearchIcon className='h-3 w-3' />
                            search
                        </motion.button>
                    </motion.label>
                </AnimatePresence>
                <motion.small
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 1.5 } }}
                    className='mt-8 text-center text-xs flex flex-row gap-1'
                >
                    <Link
                        title='Visit our Github Repository'
                        href='/updates'
                        className='text-accent opacity-60 hover:opacity-100 transition-opacity cursor-pointer'
                    >
                        See what{"'"}s new.
                    </Link>
                </motion.small>
                <motion.small
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 1.5 } }}
                    className='mt-2 text-center text-xs flex flex-row gap-1'
                >
                    <span className='opacity-60'>2026 DeckyVault.</span>
                    <Link
                        title='Visit our Github Repository'
                        href='https://github.com/AdrianBonpin/deckyvault'
                        className='text-accent opacity-60 hover:opacity-100 transition-opacity cursor-pointer'
                    >
                        Github.
                    </Link>
                    <span className='opacity-60'>
                        v{process.env.NEXT_PUBLIC_APP_VERSION}
                    </span>
                </motion.small>
            </section>

            {/* ── Landing Sections ── */}
            <div className='w-full max-w-7xl mx-auto px-4 pb-12 space-y-10'>
                {sectionsLoading ? (
                    <SkeletonSections />
                ) : (
                    <>
                        {sections.recentBenchmarks.length > 0 && (
                            <GameSection
                                title='Recently Added Benchmarks'
                                icon={ClockIcon}
                                games={sections.recentBenchmarks}
                                statKey='benchmark_count'
                                statLabel='benchmarks'
                                accentColor='text-violet-400'
                            />
                        )}
                        {sections.trending.length > 0 && (
                            <GameSection
                                title='Trending This Week'
                                icon={TrendingUpIcon}
                                games={sections.trending}
                                statKey='benchmark_count'
                                statLabel='benchmarks this week'
                                accentColor='text-orange-400'
                            />
                        )}
                        {sections.mostTested.length > 0 && (
                            <GameSection
                                title='Most Tested Games'
                                icon={GaugeIcon}
                                games={sections.mostTested}
                                statKey='benchmark_count'
                                statLabel='benchmarks'
                                accentColor='text-blue-400'
                            />
                        )}
                        {sections.onSale.length > 0 && (
                            <SaleSection games={sections.onSale} />
                        )}
                    </>
                )}
            </div>

            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        name: "DeckyVault",
                        url: "https://deckyvault.xyz",
                        description:
                            "Steam Deck benchmarks, settings, and performance guides",
                        potentialAction: {
                            "@type": "SearchAction",
                            target: "https://deckyvault.xyz/search?q={search_term_string}",
                            "query-input": "required name=search_term_string",
                        },
                    }),
                }}
            />

            {/* Organization structured data */}
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Organization",
                        name: "DeckyVault",
                        url: "https://deckyvault.xyz",
                        logo: "https://deckyvault.xyz/icon.png",
                        sameAs: [
                            "https://github.com/AdrianBonpin/deckyvault",
                        ],
                    }),
                }}
            />
        </>
    )
}

"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ExternalLinkIcon, Gamepad2Icon, MessageSquareIcon, SettingsIcon, TrendingUpIcon } from "lucide-react"
import Image from "next/image"

interface UnifiedResult {
    kind: "local" | "steam"
    id?: string
    appId: number | null
    title: string
    image: string | null
    developer: string | null
    publisher: string | null
    source: string
    counts: { benchmarks: number; presets: number; comments: number } | null
}

function SearchContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const query = searchParams.get("q") || ""

    const [results, setResults] = useState<UnifiedResult[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!query) {
            setResults([])
            return
        }

        let cancelled = false

        async function fetchResults() {
            setLoading(true)
            setError(null)

            try {
                const res = await fetch(
                    `/api/search/unified?q=${encodeURIComponent(query)}`,
                )
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
        return () => { cancelled = true }
    }, [query])

    function handleClick(result: UnifiedResult) {
        const path = result.appId
            ? `/game/${result.appId}`
            : `/game/${result.id}`
        router.push(path)
    }

    return (
        <section className="w-full min-h-[calc(100vh-3.6rem)] flex flex-col items-center p-4 md:px-[10svw]">
            <div className="w-full max-w-7xl">
                <h1 className="text-2xl font-light mb-2">
                    {query ? `results for "${query}"` : "search using game name or appid"}
                </h1>
                <p className="text-text/60 text-sm mb-8">
                    {query
                        ? `${results.length} result${results.length !== 1 ? "s" : ""} found`
                        : "Enter a game name or AppID to find benchmarks, settings, and reviews."}
                </p>

                {!query && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Gamepad2Icon className="h-12 w-12 text-text/20" />
                        <p className="text-text/40 text-sm">
                            Start typing to search for games
                        </p>
                    </div>
                )}

                {query && loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                        <p className="text-text/60 text-sm">
                            Searching for &quot;{query}&quot;...
                        </p>
                    </div>
                )}

                {query && !loading && error && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {query && !loading && !error && results.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Gamepad2Icon className="h-12 w-12 text-text/20" />
                        <p className="text-text/40 text-sm">
                            No results found for &quot;{query}&quot;
                        </p>
                    </div>
                )}

                {query && !loading && !error && results.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.map((result, idx) => (
                            <SearchResultCard
                                key={result.kind === "local" ? result.id : `steam-${result.appId}-${idx}`}
                                result={result}
                                onClick={handleClick}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

function SearchResultCard({
    result,
    onClick,
}: {
    result: UnifiedResult
    onClick: (r: UnifiedResult) => void
}) {
    const isLocal = result.kind === "local"
    const hasData = isLocal && result.counts && (
        result.counts.benchmarks > 0 ||
        result.counts.presets > 0 ||
        result.counts.comments > 0
    )
    const hasDeveloperInfo = result.developer || result.publisher

    return (
        <div
            className="group flex flex-col gap-3 p-3 rounded-lg border border-border bg-text/5 hover:border-primary/50 transition-all cursor-pointer"
            onClick={() => onClick(result)}
        >
            {/* Image */}
            <div className="relative w-full aspect-[460/215] rounded-md overflow-hidden bg-text/10">
                {result.image ? (
                    <Image
                        src={result.image}
                        alt={result.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Gamepad2Icon className="h-8 w-8 text-text/20" />
                    </div>
                )}
                {/* Source badge */}
                <div className="absolute top-2 right-2 flex gap-1">
                    {isLocal && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-primary/90 text-white px-1.5 py-0.5 rounded">
                            In Database
                        </span>
                    )}
                    {!isLocal && result.appId && (
                        <a
                            href={`https://store.steampowered.com/app/${result.appId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-medium uppercase tracking-wider bg-text/80 text-background px-1.5 py-0.5 rounded flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            Steam
                            <ExternalLinkIcon className="h-2.5 w-2.5" />
                        </a>
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1 min-w-0">
                <p className="font-medium text-sm truncate leading-tight">
                    {result.title}
                </p>
                {hasDeveloperInfo ? (
                    <p className="text-xs text-text/50 truncate">
                        {result.developer || result.publisher}
                    </p>
                ) : !isLocal && result.appId ? (
                    <p className="text-xs text-text/40">
                        AppID: {result.appId}
                    </p>
                ) : null}
            </div>

            {/* Stats (local only) */}
            {isLocal && result.counts && (
                <div className="flex flex-row gap-3 text-[11px] text-text/50">
                    {result.counts.benchmarks > 0 && (
                        <span className="flex items-center gap-1">
                            <TrendingUpIcon className="h-3 w-3" />
                            {result.counts.benchmarks}
                        </span>
                    )}
                    {result.counts.presets > 0 && (
                        <span className="flex items-center gap-1">
                            <SettingsIcon className="h-3 w-3" />
                            {result.counts.presets}
                        </span>
                    )}
                    {result.counts.comments > 0 && (
                        <span className="flex items-center gap-1">
                            <MessageSquareIcon className="h-3 w-3" />
                            {result.counts.comments}
                        </span>
                    )}
                    {!hasData && (
                        <span className="text-text/30 italic">No data yet</span>
                    )}
                </div>
            )}
        </div>
    )
}

export default function SearchPage() {
    return (
        <Suspense>
            <SearchContent />
        </Suspense>
    )
}

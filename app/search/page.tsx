"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Gamepad2Icon } from "lucide-react"

function SearchContent() {
    const searchParams = useSearchParams()
    const query = searchParams.get("q") || ""

    return (
        <section className="w-full min-h-[calc(100vh-3.6rem)] flex flex-col items-center p-4 md:px-[10svw]">
            <div className="w-full max-w-7xl">
                <h1 className="text-2xl font-light mb-2">
                    {query ? `results for "${query}"` : "search using game name or appid"}
                </h1>
                <p className="text-text/60 text-sm mb-8">
                    {query
                        ? "Showing results from the database..."
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

                {query && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                        <p className="text-text/60 text-sm">
                            Searching for &quot;{query}&quot;...
                        </p>
                    </div>
                )}
            </div>
        </section>
    )
}

export default function SearchPage() {
    return (
        <Suspense>
            <SearchContent />
        </Suspense>
    )
}

import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { after } from "next/server"
import { db } from "@/lib/db/index"
import {
    games,
    gameVersions,
    performanceEntries,
    gameComments,
    gamePlatformSupport,
    hardware,
    user,
} from "@/lib/db/schema"
import { and, desc, eq, sql } from "drizzle-orm"
import { isSyncStale, syncSteamGame, ensureSteamGame } from "@/lib/steam/sync"
import { GamePageClient } from "./game-page-client"

// This page needs live data — skip static generation at build time
export const dynamic = "force-dynamic"

async function resolveGame(id: string) {
    const isNumeric = /^\d+$/.test(id)
    let game
    if (isNumeric) {
        const rows = await db
            .select()
            .from(games)
            .where(eq(games.steamAppId, Number(id)))
            .limit(1)
        game = rows[0]
    } else {
        const rows = await db
            .select()
            .from(games)
            .where(eq(games.id, id))
            .limit(1)
        game = rows[0]
    }
    return game
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const game = await resolveGame(id)

    if (!game) {
        return { title: "Game Not Found | DeckyVault" }
    }

    const description = game.description
        ? game.description.slice(0, 160)
        : `Find benchmarks, community presets, and performance settings for ${game.title} on Steam Deck.`

    return {
        title: `${game.title} - Benchmarks & Settings`,
        description,
        alternates: { canonical: `https://deckyvault.xyz/game/${game.id}` },
        openGraph: {
            title: `${game.title} - Benchmarks & Settings | DeckyVault`,
            description: game.description?.slice(0, 200) ?? `Benchmarks and settings for ${game.title}`,
            url: `https://deckyvault.xyz/game/${game.id}`,
            images: [{ url: `/game/${game.id}/opengraph-image`, width: 1200, height: 630 }],
            type: "website",
            siteName: "DeckyVault",
        },
        twitter: {
            card: "summary_large_image",
            title: `${game.title} - Benchmarks & Settings | DeckyVault`,
            description: game.description?.slice(0, 200) ?? `Benchmarks and settings for ${game.title}`,
            images: [`/game/${game.id}/opengraph-image`],
        },
    }
}

async function createGameStub(steamAppId: number) {
    const result = await ensureSteamGame(steamAppId)
    if (!result.game) {
        notFound()
    }
    // If the sync determined this is not a game (DLC, soundtrack, etc.),
    // treat it as not found rather than showing a broken page
    if (result.game.syncStatus === "error" && result.error?.includes("not a game")) {
        notFound()
    }
    return result.game
}

export default async function GamePage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ sync?: string }>
}) {
    const { id } = await params
    const { sync } = await searchParams
    const isNumeric = /^\d+$/.test(id)
    const forceSync = sync === "1"

    // ── Resolve game ────────────────────────────────────────────────
    let game = await resolveGame(id)

    if (!game && isNumeric) {
        try {
            game = await createGameStub(Number(id))
        } catch (err) {
            console.error("Failed to auto-create game stub:", err)
        }
    }

    if (!game) {
        notFound()
    }

    // ── Fetch related data in parallel ──────────────────────────────
    const [
        benchmarkCount,
        presetCount,
        commentCount,
        platformSupport,
        presetRows,
    ] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)::int` })
            .from(performanceEntries)
            .innerJoin(
                gameVersions,
                eq(performanceEntries.versionId, gameVersions.id),
            )
            .where(eq(gameVersions.gameId, game.id))
            .then((r) => r[0]?.count ?? 0),
        db
            .select({ count: sql<number>`count(*)::int` })
            .from(performanceEntries)
            .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
            .where(
                and(
                    eq(gameVersions.gameId, game.id),
                    eq(performanceEntries.isRemoved, false),
                    sql`${performanceEntries.settingsJson} IS NOT NULL`,
                ),
            )
            .then((r) => r[0]?.count ?? 0),
        db
            .select({ count: sql<number>`count(*)::int` })
            .from(gameComments)
            .where(eq(gameComments.gameId, game.id))
            .then((r) => r[0]?.count ?? 0),
        db
            .select()
            .from(gamePlatformSupport)
            .where(eq(gamePlatformSupport.gameId, game.id))
            .then((r) => r),
        db
            .select({
                id: performanceEntries.id,
                hardwareSlug: performanceEntries.hardwareSlug,
                hardwareName: hardware.name,
                upvotes: performanceEntries.upvotes,
                settingsJson: performanceEntries.settingsJson,
                fpsAvg: performanceEntries.fpsAvg,
                fpsLow: performanceEntries.fpsLow,
                fpsHigh: performanceEntries.fpsHigh,
                fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
                upscalerType: performanceEntries.upscalerType,
                upscalerVersion: performanceEntries.upscalerVersion,
                frameGenMethod: performanceEntries.frameGenMethod,
                protonVersion: performanceEntries.protonVersion,
                osVersion: performanceEntries.osVersion,
                createdAt: performanceEntries.createdAt,
                userId: performanceEntries.userId,
                userName: user.name,
                userImage: user.image,
                downvotes: performanceEntries.downvotes,
                launchOptions: performanceEntries.launchOptions,
                loadTimeSsd: performanceEntries.loadTimeSsd,
                loadTimeSd: performanceEntries.loadTimeSd,
                estimatedBatteryMin: performanceEntries.estimatedBatteryMin,
                customSystem: performanceEntries.customSystem,
                userNotes: performanceEntries.userNotes,
                verifiedAt: performanceEntries.verifiedAt,
                isPinned: performanceEntries.isPinned,
                pinnedAt: performanceEntries.pinnedAt,
            })
            .from(performanceEntries)
            .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
            .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
            .innerJoin(user, eq(performanceEntries.userId, user.id))
            .where(
                and(
                    eq(gameVersions.gameId, game.id),
                    eq(performanceEntries.isRemoved, false),
                    sql`${performanceEntries.settingsJson} IS NOT NULL`,
                ),
            )
            .orderBy(desc(performanceEntries.isPinned), desc(performanceEntries.upvotes)),
    ])

    // ── Sync logic: force or stale-while-revalidate ────────────────
    const shouldSync =
        game.source === "steam" &&
        game.steamAppId &&
        (forceSync || isSyncStale(game.lastSync))

    if (shouldSync) {
        if (forceSync) {
            // Block render on forced sync so user sees fresh data immediately
            await syncSteamGame(game.steamAppId!)
            // Re-fetch game after sync so serialized data is fresh
            const refreshed = await resolveGame(game.steamAppId!.toString())
            if (refreshed) game = refreshed
        } else {
            // Stale sync happens after response so page isn't delayed
            after(async () => {
                await syncSteamGame(game.steamAppId!)
            })
        }
    }

    // Serialize for client component (Dates → strings)
    const serializedGame = {
        id: game.id,
        steamAppId: game.steamAppId,
        title: game.title,
        description: game.description,
        developer: game.developer,
        publisher: game.publisher,
        genres: game.genres,
        headerImage: game.headerImage,
        capsuleImage: game.capsuleImage,
        storeUrl: game.storeUrl,
        source: game.source,
        lastSync: game.lastSync ? game.lastSync.toISOString() : null,
        syncStatus: game.syncStatus,
        createdAt: game.createdAt.toISOString(),
        systemRequirements: game.systemRequirements,
        metacriticScore: game.metacriticScore,
        metacriticUrl: game.metacriticUrl,
        recommendationsTotal: game.recommendationsTotal,
        priceCurrent: game.priceCurrent,
        priceInitial: game.priceInitial,
        priceCurrency: game.priceCurrency,
        isFree: game.isFree,
        releaseDate: game.releaseDate,
        categories: game.categories,
        platforms: game.platforms,
        steamReviewScore: game.steamReviewScore,
        steamReviewSentiment: game.steamReviewSentiment,
        steamReviewCount: game.steamReviewCount,
    }

    const serializedPresets = presetRows.map((p) => ({
        id: p.id,
        gameId: game.id,
        hardwareSlug: p.hardwareSlug,
        hardwareName: p.hardwareName,
        upvotes: p.upvotes,
        settingsCount: Array.isArray(p.settingsJson)
            ? p.settingsJson.reduce(
                  (sum: number, cat: { settings: unknown[] }) =>
                      sum + cat.settings.length,
                  0,
              )
            : 0,
        fpsAvg: p.fpsAvg,
        fpsLow: p.fpsLow,
        fpsHigh: p.fpsHigh,
        fpsOnePercentLow: p.fpsOnePercentLow ?? null,
        upscalerType: p.upscalerType,
        upscalerVersion: p.upscalerVersion,
        frameGenMethod: p.frameGenMethod,
        protonVersion: p.protonVersion,
        osVersion: p.osVersion,
        createdAt: p.createdAt.toISOString(),
        settingsJson: p.settingsJson,
        launchOptions: p.launchOptions,
        loadTimeSsd: p.loadTimeSsd ?? null,
        loadTimeSd: p.loadTimeSd ?? null,
        estimatedBatteryMin: p.estimatedBatteryMin ?? null,
        customSystem: p.customSystem ?? false,
        userNotes: p.userNotes,
        userId: p.userId,
        userName: p.userName,
        userImage: p.userImage,
        downvotes: p.downvotes,
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
        isPinned: p.isPinned,
        pinnedAt: p.pinnedAt ? p.pinnedAt.toISOString() : null,
    }))

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "VideoGame",
                        name: game.title,
                        ...(game.developer && { developer: { "@type": "Organization", name: game.developer } }),
                        ...(game.genres && game.genres.length > 0 && { genre: game.genres }),
                        ...(game.headerImage && { image: game.headerImage }),
                        url: `https://deckyvault.xyz/game/${game.id}`,
                        applicationCategory: "Game",
                        operatingSystem: "SteamOS",
                        ...(game.storeUrl && { offers: { "@type": "Offer", url: game.storeUrl } }),
                    }),
                }}
            />
            <Suspense fallback={<div className="min-h-screen" />}>
                <GamePageClient
                    game={serializedGame}
                    counts={{
                        benchmarks: benchmarkCount,
                        presets: presetCount,
                        comments: commentCount,
                    }}
                    platformSupport={platformSupport}
                    presets={serializedPresets}
                    gameId={game.id}
                />
            </Suspense>
        </>
    )
}

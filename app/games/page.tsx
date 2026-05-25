import type { Metadata } from "next"
import { after } from "next/server"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  gamePlatformSupport,
  hardware,
} from "@/lib/db/schema"
import { sql, eq, and, desc, inArray } from "drizzle-orm"
import { isSyncStale, syncSteamGame } from "@/lib/steam/sync"
import { GamesPageClient } from "./games-page-client"

// This page needs live data — skip static generation at build time
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Games",
  description:
    "Browse the full catalog of Steam Deck games with benchmarks, community settings, and performance data. Filter by genre, device, and more.",
  keywords: [
    "Steam Deck games",
    "game benchmarks",
    "Steam Deck settings",
    "game catalog",
    "performance data",
  ],
  alternates: { canonical: "https://deckyvault.xyz/games" },
  openGraph: {
    title: "Games | DeckyVault",
    description:
      "Browse the full catalog of Steam Deck games with benchmarks and performance data.",
    url: "https://deckyvault.xyz/games",
    siteName: "DeckyVault",
    type: "website",
  },
}

export default async function GamesPage() {
  // Fetch initial 24 games
  const gamesData = await db
    .select({
      id: games.id,
      steamAppId: games.steamAppId,
      title: games.title,
      developer: games.developer,
      capsuleImage: games.capsuleImage,
      headerImage: games.headerImage,
      genres: games.genres,
      source: games.source,
      createdAt: games.createdAt,
      steamReviewScore: games.steamReviewScore,
      playabilityStatus: games.playabilityStatus,
      onlineMultiplayerStatus: games.onlineMultiplayerStatus,
      lastSync: games.lastSync,
    })
    .from(games)
    .orderBy(desc(games.createdAt))
    .limit(24)

  // Get total count
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(games)

  // Get benchmark counts for the initial games
  const gameIds = gamesData.map((g) => g.id)

  const benchmarkCounts = gameIds.length > 0
    ? await db
        .select({
          gameId: gameVersions.gameId,
          count: sql<number>`count(*)::int`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(
          and(
            inArray(gameVersions.gameId, gameIds),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .groupBy(gameVersions.gameId)
    : []

  const benchmarkMap = new Map<string, number>()
  for (const row of benchmarkCounts) {
    benchmarkMap.set(row.gameId, row.count)
  }

  // Fetch platform support for initial games (prioritise Steam Deck)
  const platformRows = gameIds.length > 0
    ? await db
        .select({
          gameId: gamePlatformSupport.gameId,
          hardwareSlug: gamePlatformSupport.hardwareSlug,
          protonStatus: gamePlatformSupport.protonStatus,
          antiCheatRelevant: gamePlatformSupport.antiCheatRelevant,
          antiCheatStatus: gamePlatformSupport.antiCheatStatus,
        })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, gameIds))
    : []

  const platformMap = new Map<string, string>()
  const antiCheatMap = new Map<string, { antiCheatRelevant: boolean; antiCheatStatus: "none" | "supported" | "unsupported" | "unknown" | null }>()
  for (const row of platformRows) {
    const isSteamDeck = row.hardwareSlug.startsWith("steamdeck")
    const existing = platformMap.get(row.gameId)
    if (!existing || (!existing.startsWith("steamdeck") && isSteamDeck)) {
      platformMap.set(row.gameId, row.protonStatus)
    }

    const existingAc = antiCheatMap.get(row.gameId)
    if (row.antiCheatRelevant) {
      if (!existingAc || (!existingAc.antiCheatRelevant && isSteamDeck) || (!existingAc.antiCheatRelevant)) {
        antiCheatMap.set(row.gameId, {
          antiCheatRelevant: row.antiCheatRelevant,
          antiCheatStatus: row.antiCheatStatus,
        })
      }
    }
  }

  // Performance stats: best FPS, raw performer, poor performance, battery estimate
  const rawPerformerMap = new Map<string, boolean>()
  const poorPerformerMap = new Map<string, boolean>()
  const bestFpsMap = new Map<string, number>()
  const batteryMinMap = new Map<string, number>()

  if (gameIds.length > 0) {
    const perfStats = await db
      .select({
        gameId: gameVersions.gameId,
        bestFps: sql<number>`MAX(${performanceEntries.fpsAvg})::real`,
        isRawPerformer: sql<boolean>`BOOL_OR(
          ${performanceEntries.fpsAvg} >= 60
          AND ${performanceEntries.upscalerType} = 'none'
          AND ${performanceEntries.frameGenMethod} = 'none'
        )`,
        isPoorPerformance: sql<boolean>`BOOL_OR(${performanceEntries.fpsAvg} < 30)`,
      })
      .from(performanceEntries)
      .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
      .innerJoin(hardware, and(
        eq(performanceEntries.hardwareSlug, hardware.slug),
        eq(hardware.deviceType, "handheld"),
      ))
      .where(
        and(
          inArray(gameVersions.gameId, gameIds),
          eq(performanceEntries.isRemoved, false),
        ),
      )
      .groupBy(gameVersions.gameId)

    for (const row of perfStats) {
      bestFpsMap.set(row.gameId, row.bestFps)
      rawPerformerMap.set(row.gameId, row.isRawPerformer)
      poorPerformerMap.set(row.gameId, row.isPoorPerformance)
    }

    // Battery estimate for handheld devices
    const batteryStats = await db
      .select({
        gameId: gameVersions.gameId,
        estimatedBatteryMin: sql<number>`ROUND(
          (${hardware.wattHours}::real / ${performanceEntries.tdpWatts}) * 60
        )::int`,
      })
      .from(performanceEntries)
      .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
      .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
      .where(
        and(
          inArray(gameVersions.gameId, gameIds),
          eq(performanceEntries.isRemoved, false),
          eq(hardware.deviceType, "handheld"),
          sql`${performanceEntries.tdpWatts} IS NOT NULL AND ${performanceEntries.tdpWatts} > 0`,
          sql`${hardware.wattHours} IS NOT NULL`,
        ),
      )
      .orderBy(desc(performanceEntries.fpsAvg))

    const seenGames = new Set<string>()
    for (const row of batteryStats) {
      if (!seenGames.has(row.gameId)) {
        seenGames.add(row.gameId)
        batteryMinMap.set(row.gameId, row.estimatedBatteryMin)
      }
    }
  }

  // Fetch all genres
  const genreRows = await db
    .select({ genres: games.genres })
    .from(games)
    .where(sql`${games.genres} IS NOT NULL`)

  const genreSet = new Set<string>()
  for (const row of genreRows) {
    if (Array.isArray(row.genres)) {
      for (const g of row.genres) {
        if (typeof g === "string") genreSet.add(g)
      }
    }
  }

  // Fetch all hardware devices
  const deviceRows = await db
    .select({ slug: hardware.slug, name: hardware.name })
    .from(hardware)
    .orderBy(hardware.sortOrder)

  // Serialize for client
  const initialGames = gamesData.map((g) => ({
    id: g.id,
    steamAppId: g.steamAppId,
    title: g.title,
    developer: g.developer,
    capsuleImage: g.capsuleImage,
    headerImage: g.headerImage,
    genres: g.genres,
    source: g.source,
    steamReviewScore: g.steamReviewScore,
    playabilityStatus: g.playabilityStatus,
    onlineMultiplayerStatus: g.onlineMultiplayerStatus,
    benchmarkCount: benchmarkMap.get(g.id) ?? 0,
    deckStatus: platformMap.get(g.id) ?? null,
    antiCheatRelevant: antiCheatMap.get(g.id)?.antiCheatRelevant ?? false,
    antiCheatStatus: antiCheatMap.get(g.id)?.antiCheatStatus ?? null,
    bestFps: bestFpsMap.get(g.id) ?? null,
    isRawPerformer: rawPerformerMap.get(g.id) ?? false,
    isPoorPerformance: poorPerformerMap.get(g.id) ?? false,
    estimatedBatteryMin: batteryMinMap.get(g.id) ?? null,
  }))

  const allGenres = Array.from(genreSet).sort()
  const allDevices = deviceRows

  // ── Background sync for stale games ────────────────────────────────
  const staleSteamAppIds = gamesData
    .filter((g) => g.source === "steam" && g.steamAppId && isSyncStale(g.lastSync))
    .map((g) => g.steamAppId!)

  if (staleSteamAppIds.length > 0) {
    after(async () => {
      // Sync stale games sequentially with a small delay to avoid rate-limiting
      for (const appId of staleSteamAppIds) {
        try {
          await syncSteamGame(appId)
        } catch {
          // Stale sync failure is non-fatal — data will be refreshed on next visit
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    })
  }

  // JSON-LD ItemList
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: initialGames.map((game, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: game.title,
      url: `https://deckyvault.xyz/game/${game.id}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GamesPageClient
        initialGames={initialGames}
        totalCount={totalCount}
        allGenres={allGenres}
        allDevices={allDevices}
      />
    </>
  )
}
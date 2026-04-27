import type { Metadata } from "next"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  gamePlatformSupport,
  hardware,
} from "@/lib/db/schema"
import { sql, eq, and, desc, inArray } from "drizzle-orm"
import { GamesPageClient } from "./games-page-client"

export const metadata: Metadata = {
  title: "Games — DeckyVault",
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
    title: "Games — DeckyVault",
    description:
      "Browse the full catalog of Steam Deck games with benchmarks and performance data.",
    url: "https://deckyvault.xyz/games",
    siteName: "DeckyVault",
    type: "website",
  },
}

export default async function GamesPage() {
  // Fetch initial 24 games with benchmark counts
  const benchmarkCountSql = sql<number>`(
    SELECT count(*)::int FROM ${performanceEntries}
    INNER JOIN ${gameVersions} ON ${performanceEntries.versionId} = ${gameVersions.id}
    WHERE ${gameVersions.gameId} = ${games.id}
    AND ${performanceEntries.isRemoved} = false
  )`

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
      benchmarkCount: benchmarkCountSql,
    })
    .from(games)
    .orderBy(desc(games.createdAt))
    .limit(24)

  // Get total count
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(games)

  // Fetch platform support for initial games (prioritise Steam Deck)
  const gameIds = gamesData.map((g) => g.id)
  const platformRows = gameIds.length > 0
    ? await db
        .select({
          gameId: gamePlatformSupport.gameId,
          hardwareSlug: gamePlatformSupport.hardwareSlug,
          protonStatus: gamePlatformSupport.protonStatus,
        })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, gameIds))
    : []

  const platformMap = new Map<string, string>()
  for (const row of platformRows) {
    const isSteamDeck = row.hardwareSlug.startsWith("steamdeck")
    const existing = platformMap.get(row.gameId)
    if (!existing || (!existing.startsWith("steamdeck") && isSteamDeck)) {
      platformMap.set(row.gameId, row.protonStatus)
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
    benchmarkCount: g.benchmarkCount,
    deckStatus: platformMap.get(g.id) ?? null,
  }))

  const allGenres = Array.from(genreSet).sort()
  const allDevices = deviceRows

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

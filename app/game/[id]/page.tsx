import { notFound } from "next/navigation"
import { after } from "next/server"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  communityPresets,
  gameComments,
  gamePlatformSupport,
  hardware,
} from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { isSyncStale, syncSteamGame } from "@/lib/steam/sync"
import { GamePageClient } from "./game-page-client"

export const metadata = {
  title: "Game",
}

async function createGameStub(steamAppId: number) {
  const url = new URL("https://store.steampowered.com/api/appdetails/")
  url.searchParams.set("appids", String(steamAppId))
  url.searchParams.set("cc", "US")
  url.searchParams.set("l", "en")

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  })

  let title = `Steam App ${steamAppId}`
  let developer: string | null = null
  let publisher: string | null = null
  let genres: string[] | null = null
  let headerImage: string | null = null
  let capsuleImage: string | null = null
  let description: string | null = null

  if (res.ok) {
    const data = (await res.json()) as Record<
      string,
      {
        success: boolean
        data: {
          type?: string
          name: string
          developers?: string[]
          publishers?: string[]
          genres?: { description: string }[]
          header_image?: string
          short_description?: string
        }
      }
    >
    const entry = data[String(steamAppId)]
    if (entry?.success && entry.data) {
      if (entry.data.type && entry.data.type !== "game") {
        notFound()
      }
      title = entry.data.name
      developer = entry.data.developers?.[0] ?? null
      publisher = entry.data.publishers?.[0] ?? null
      genres = entry.data.genres?.map((g) => g.description) ?? []
      headerImage = entry.data.header_image ?? null
      capsuleImage = `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`
      description = entry.data.short_description ?? null
    }
  }

  const [game] = await db
    .insert(games)
    .values({
      steamAppId,
      source: "steam",
      title,
      developer,
      publisher,
      genres,
      headerImage,
      capsuleImage,
      description,
      storeUrl: `https://store.steampowered.com/app/${steamAppId}`,
      lastSync: new Date(),
      syncStatus: "synced",
    })
    .returning()

  return game
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
  const [benchmarkCount, presetCount, commentCount, platformSupport, presetRows] =
    await Promise.all([
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
        .from(communityPresets)
        .where(eq(communityPresets.gameId, game.id))
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
          id: communityPresets.id,
          name: communityPresets.name,
          description: communityPresets.description,
          hardwareSlug: communityPresets.hardwareSlug,
          hardwareName: hardware.name,
          upvotes: communityPresets.upvotes,
          settingsJson: communityPresets.settingsJson,
          createdAt: communityPresets.createdAt,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          fsrVersion: performanceEntries.fsrVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
        })
        .from(communityPresets)
        .leftJoin(
          performanceEntries,
          eq(communityPresets.performanceEntryId, performanceEntries.id),
        )
        .innerJoin(
          hardware,
          eq(communityPresets.hardwareSlug, hardware.slug),
        )
        .where(eq(communityPresets.gameId, game.id))
        .orderBy(sql`${communityPresets.upvotes} DESC`),
    ])

  // ── Sync logic: force or stale-while-revalidate ─────────────────
  const shouldSync =
    game.source === "steam" &&
    game.steamAppId &&
    (forceSync || isSyncStale(game.lastSync))

  if (shouldSync) {
    after(async () => {
      await syncSteamGame(game.steamAppId!)
    })
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
  }

  const serializedPresets = presetRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
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
    fsrVersion: p.fsrVersion,
    frameGenMethod: p.frameGenMethod,
    protonVersion: p.protonVersion,
    osVersion: p.osVersion,
    createdAt: p.createdAt.toISOString(),
  }))

  return (
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
  )
}

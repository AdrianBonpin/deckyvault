import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  gameComments,
} from "@/lib/db/schema"
import { ilike, or, sql, eq, inArray, and } from "drizzle-orm"

interface SteamSearchItem {
  id: number
  name: string
  tiny_image: string
  metascore: string
  price?: { currency: string; initial: number; final: number }
  platforms: { windows: boolean; mac: boolean; linux: boolean }
  controller_support?: string
}

interface SteamSearchResponse {
  items: SteamSearchItem[]
  total: number
}

export const searchUnifiedRoutes = new Elysia({ prefix: "/search" }).get(
  "/unified",
  async ({ query, set }) => {
    if (!query.q || query.q.length < 2) {
      set.status = 400
      return { error: "Query must be at least 2 characters" }
    }

    const term = `%${query.q}%`

    // ── 1. Search local database ────────────────────────────────────
    const localGames = await db
      .select()
      .from(games)
      .where(
        or(
          ilike(games.title, term),
          ilike(games.developer, term),
          ilike(games.publisher, term),
        ),
      )
      .limit(20)

    const localGameIds = localGames.map((g) => g.id)
    const localSteamAppIds = new Set(
      localGames.map((g) => g.steamAppId).filter(Boolean),
    )

    // Fetch platform support + anti-cheat for local games
    const platformSupportMap = new Map<
      string,
      {
        isSupported: boolean
        protonStatus: string
        antiCheatRelevant: boolean
        antiCheatName: string | null
        antiCheatStatus: string
      }
    >()
    if (localGameIds.length > 0) {
      const { gamePlatformSupport } = await import("@/lib/db/schema")
      const supportRows = await db
        .select({
          gameId: gamePlatformSupport.gameId,
          isSupported: gamePlatformSupport.isSupported,
          protonStatus: gamePlatformSupport.protonStatus,
          antiCheatRelevant: gamePlatformSupport.antiCheatRelevant,
          antiCheatName: gamePlatformSupport.antiCheatName,
          antiCheatStatus: gamePlatformSupport.antiCheatStatus,
        })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, localGameIds))

      for (const row of supportRows) {
        platformSupportMap.set(row.gameId, {
          isSupported: row.isSupported,
          protonStatus: row.protonStatus,
          antiCheatRelevant: row.antiCheatRelevant,
          antiCheatName: row.antiCheatName,
          antiCheatStatus: row.antiCheatStatus,
        })
      }
    }

    // ── 2. Count related data for local games ───────────────────────
    let benchmarkCounts: { gameId: string; count: number }[] = []
    let presetCounts: { gameId: string; count: number }[] = []
    let commentCounts: { gameId: string; count: number }[] = []

    if (localGameIds.length > 0) {
      const [bCounts, pCounts, cCounts] = await Promise.all([
        db
          .select({
            gameId: gameVersions.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(performanceEntries)
          .innerJoin(
            gameVersions,
            eq(performanceEntries.versionId, gameVersions.id),
          )
          .where(
            and(
              inArray(gameVersions.gameId, localGameIds),
              eq(performanceEntries.isRemoved, false),
            ),
          )
          .groupBy(gameVersions.gameId),
        db
          .select({
            gameId: gameVersions.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(performanceEntries)
          .innerJoin(
            gameVersions,
            eq(performanceEntries.versionId, gameVersions.id),
          )
          .where(
            and(
              inArray(gameVersions.gameId, localGameIds),
              eq(performanceEntries.isRemoved, false),
              sql`${performanceEntries.settingsJson} IS NOT NULL`,
            ),
          )
          .groupBy(gameVersions.gameId),
        db
          .select({
            gameId: gameComments.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(gameComments)
          .where(inArray(gameComments.gameId, localGameIds))
          .groupBy(gameComments.gameId),
      ])
      benchmarkCounts = bCounts
      presetCounts = pCounts
      commentCounts = cCounts
    }

    const countMap = new Map<
      string,
      { benchmarks: number; presets: number; comments: number }
    >()
    for (const g of localGames) {
      countMap.set(g.id, { benchmarks: 0, presets: 0, comments: 0 })
    }
    for (const c of benchmarkCounts) {
      countMap.get(c.gameId)!.benchmarks = c.count
    }
    for (const c of presetCounts) {
      countMap.get(c.gameId)!.presets = c.count
    }
    for (const c of commentCounts) {
      countMap.get(c.gameId)!.comments = c.count
    }

    // ── 2b. Raw Performer + Poor Performance + best FPS ────────────
    const rawPerformerMap = new Map<string, boolean>()
    const poorPerformerMap = new Map<string, boolean>()
    const bestFpsMap = new Map<string, number>()

    if (localGameIds.length > 0) {
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
        .innerJoin(
          gameVersions,
          eq(performanceEntries.versionId, gameVersions.id),
        )
        .where(
          and(
            inArray(gameVersions.gameId, localGameIds),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .groupBy(gameVersions.gameId)

      for (const row of perfStats) {
        bestFpsMap.set(row.gameId, row.bestFps)
        rawPerformerMap.set(row.gameId, row.isRawPerformer)
        poorPerformerMap.set(row.gameId, row.isPoorPerformance)
      }
    }

    // ── 2c. Latest version ──────────────────────────────────────────
    const latestVersionMap = new Map<string, string>()

    if (localGameIds.length > 0) {
      const versionRows = await db
        .select({
          gameId: gameVersions.gameId,
          versionString: gameVersions.versionString,
        })
        .from(gameVersions)
        .where(
          and(
            inArray(gameVersions.gameId, localGameIds),
            eq(gameVersions.isLatest, true),
          ),
        )

      for (const row of versionRows) {
        if (row.versionString) {
          latestVersionMap.set(row.gameId, row.versionString)
        }
      }
    }

    // ── 3. Search Steam ─────────────────────────────────────────────
    let steamItems: SteamSearchItem[] = []
    try {
      const url = new URL("https://store.steampowered.com/api/storesearch/")
      url.searchParams.set("term", query.q)
      url.searchParams.set("cc", "US")
      url.searchParams.set("l", "en")

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      })
      if (res.ok) {
        const data = (await res.json()) as SteamSearchResponse
        steamItems = (data.items || []).filter((item) => {
          const name = item.name.toLowerCase()
          const exclude = [
            "soundtrack",
            " original soundtrack",
            " ost",
            " - ost",
            "dlc",
            "expansion",
            "season pass",
            " deluxe edition",
            " ultimate edition",
            " premium edition",
            " demo",
            " trial",
            " playtest",
            " beta",
            " artbook",
            " soundtrack bundle",
          ]
          return !exclude.some((kw) => name.includes(kw))
        })
      }
    } catch {
      // Steam search failure is non-fatal
    }

    // ── 4. Build unified results ────────────────────────────────────
    const results = []

    // Add local games
    for (const g of localGames) {
      const counts = countMap.get(g.id)!
      const platform = platformSupportMap.get(g.id)
      results.push({
        kind: "local" as const,
        id: g.id,
        appId: g.steamAppId,
        title: g.title,
        image: g.capsuleImage || g.headerImage,
        tinyImage: g.capsuleImage || g.headerImage || null,
        developer: g.developer,
        publisher: g.publisher,
        description: g.description,
        genres: g.genres,
        source: g.source,
        counts,
        platformSupport: platform
          ? {
              isSupported: platform.isSupported,
              protonStatus: platform.protonStatus,
              antiCheatRelevant: platform.antiCheatRelevant,
              antiCheatName: platform.antiCheatName,
              antiCheatStatus: platform.antiCheatStatus,
            }
          : null,
        isRawPerformer: rawPerformerMap.get(g.id) ?? false,
        isPoorPerformance: poorPerformerMap.get(g.id) ?? false,
        bestFps: bestFpsMap.get(g.id) ?? null,
        latestVersion: latestVersionMap.get(g.id) ?? null,
        playabilityStatus: g.playabilityStatus,
        steamReviewScore: g.steamReviewScore,
        steamReviewSentiment: g.steamReviewSentiment,
        antiCheatRelevant: platform?.antiCheatRelevant ?? null,
        antiCheatStatus: platform?.antiCheatStatus ?? null,
        antiCheatName: platform?.antiCheatName ?? null,
      })
    }

    // Add Steam-only games
    for (const item of steamItems) {
      if (localSteamAppIds.has(item.id)) continue
      results.push({
        kind: "steam" as const,
        appId: item.id,
        title: item.name,
        image: `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/library_600x900.jpg`,
        tinyImage: item.tiny_image || null,
        developer: null,
        publisher: null,
        description: null,
        genres: null,
        source: "steam" as const,
        counts: null,
        platformSupport: null,
        metascore: item.metascore || null,
        price: item.price
          ? {
              currency: item.price.currency,
              initial: item.price.initial,
              final: item.price.final,
            }
          : null,
        platforms: item.platforms,
        controllerSupport: item.controller_support || null,
        isRawPerformer: false,
        bestFps: null,
        latestVersion: null,
      })
    }

    return { results, total: results.length }
  },
  {
    query: t.Object({
      q: t.String(),
    }),
  },
)

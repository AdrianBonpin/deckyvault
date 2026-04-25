import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games, gameVersions, performanceEntries, communityPresets, gameComments } from "@/lib/db/schema"
import { ilike, or, sql, eq, inArray } from "drizzle-orm"

interface SteamSearchItem {
  id: number
  name: string
  tiny_image: string
  metascore: string
  platforms: { windows: boolean; mac: boolean; linux: boolean }
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
          .where(inArray(gameVersions.gameId, localGameIds))
          .groupBy(gameVersions.gameId),
        db
          .select({
            gameId: communityPresets.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(communityPresets)
          .where(inArray(communityPresets.gameId, localGameIds))
          .groupBy(communityPresets.gameId),
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
        steamItems = data.items || []
      }
    } catch {
      // Steam search failure is non-fatal
    }

    // ── 4. Build unified results ────────────────────────────────────
    // Local games first (they have data), then Steam-only results
    const results = []

    // Add local games
    for (const g of localGames) {
      const counts = countMap.get(g.id)!
      results.push({
        kind: "local" as const,
        id: g.id,
        appId: g.steamAppId,
        title: g.title,
        image: g.capsuleImage || g.headerImage,
        developer: g.developer,
        publisher: g.publisher,
        source: g.source,
        counts,
      })
    }

    // Add Steam-only games (deduplicated against local steamAppIds)
    for (const item of steamItems) {
      if (localSteamAppIds.has(item.id)) continue
      results.push({
        kind: "steam" as const,
        appId: item.id,
        title: item.name,
        image: item.tiny_image,
        developer: null,
        publisher: null,
        source: "steam" as const,
        counts: null,
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

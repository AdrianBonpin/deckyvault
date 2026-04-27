import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  gamePlatformSupport,
  hardware,
} from "@/lib/db/schema"
import { ilike, or, sql, eq, and, desc, asc, inArray } from "drizzle-orm"

const MAX_OFFSET = 10000
const PAGE_SIZE = 24

export const gamesListingRoutes = new Elysia({ prefix: "/games/listing" }).get(
  "/",
  async ({ query, set }) => {
    const offset = Math.min(Number(query.offset) || 0, MAX_OFFSET)
    const limit = Math.min(Number(query.limit) || PAGE_SIZE, 100)
    const search = query.search || ""
    const genre = query.genre || ""
    const device = query.device || ""
    const sort = query.sort || "recent"

    // Build where conditions
    const conditions = []

    if (search) {
      const term = `%${search}%`
      conditions.push(
        or(
          ilike(games.title, term),
          ilike(games.developer, term),
          ilike(games.publisher, term),
        )!,
      )
    }

    if (genre) {
      conditions.push(sql`${games.genres} @> ${JSON.stringify([genre])}::jsonb`)
    }

    if (device) {
      const supportedIds = await db
        .select({ gameId: gamePlatformSupport.gameId })
        .from(gamePlatformSupport)
        .where(
          and(
            eq(gamePlatformSupport.hardwareSlug, device),
            eq(gamePlatformSupport.isSupported, true),
          ),
        )
      if (supportedIds.length > 0) {
        conditions.push(inArray(games.id, supportedIds.map((s) => s.gameId)))
      } else {
        return { data: [], total: 0, limit, offset, genres: [], devices: [] }
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    // Subquery for benchmark count — referenced in both SELECT and ORDER BY
    const benchmarkCountSql = sql<number>`(
      SELECT count(*)::int FROM ${performanceEntries}
      INNER JOIN ${gameVersions} ON ${performanceEntries.versionId} = ${gameVersions.id}
      WHERE ${gameVersions.gameId} = ${games.id}
      AND ${performanceEntries.isRemoved} = false
    )`

    // Determine sort order
    let orderBy
    switch (sort) {
      case "name":
        orderBy = asc(games.title)
        break
      case "benchmarks":
        orderBy = desc(benchmarkCountSql)
        break
      case "recent":
      default:
        orderBy = desc(games.createdAt)
        break
    }

    // Fetch games with benchmark counts
    const gamesQuery = db
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
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    // Count total
    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(games)
      .where(where)

    // Fetch all genres (for filter options)
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

    // Fetch all hardware devices (for filter options)
    const deviceRows = await db
      .select({ slug: hardware.slug, name: hardware.name })
      .from(hardware)
      .orderBy(hardware.sortOrder)

    const [data, countResult] = await Promise.all([gamesQuery, countQuery])

    // Fetch platform support for the returned games
    // Prioritise Steam Deck entries (slug starts with "steamdeck") for deckStatus.
    // If no Steam Deck entry exists, fall back to the first available device.
    const gameIds = data.map((g) => g.id)
    let platformMap = new Map<string, string>()
    if (gameIds.length > 0) {
      const platformRows = await db
        .select({
          gameId: gamePlatformSupport.gameId,
          hardwareSlug: gamePlatformSupport.hardwareSlug,
          protonStatus: gamePlatformSupport.protonStatus,
        })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, gameIds))

      for (const row of platformRows) {
        const isSteamDeck = row.hardwareSlug.startsWith("steamdeck")
        const existing = platformMap.get(row.gameId)
        // Prefer Steam Deck entries; if we already have a non-Deck entry, replace it
        if (!existing || (!existing.startsWith("steamdeck") && isSteamDeck)) {
          platformMap.set(row.gameId, row.protonStatus)
        }
      }
    }

    const enrichedData = data.map((g) => ({
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

    return {
      data: enrichedData,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
      genres: Array.from(genreSet).sort(),
      devices: deviceRows,
    }
  },
  {
    query: t.Object({
      offset: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
      genre: t.Optional(t.String()),
      device: t.Optional(t.String()),
      sort: t.Optional(t.String()),
    }),
  },
)

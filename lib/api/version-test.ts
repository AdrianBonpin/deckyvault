/**
 * Version Fetcher Test API
 *
 * Two endpoints:
 * 1. GET /api/games/:gameId/test-version-fetchers
 *    Uses DB game ID (UUID or numeric Steam App ID) to look up the game,
 *    then runs all strategies.
 *
 * 2. GET /api/version-test?steamAppId=730
 *    Runs all strategies directly against a Steam App ID — no DB lookup needed.
 *    This is the preferred testing endpoint.
 */
import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { ALL_STRATEGIES } from "@/lib/version-fetchers/index"

async function resolveGame(gameId: string): Promise<{
  steamAppId: number
  title: string | null
  dbId: string | null
} | null> {
  // Try numeric (Steam App ID) first
  const isNumeric = /^\d+$/.test(gameId)
  const numId = isNumeric ? Number(gameId) : null

  if (numId) {
    // Look up by Steam App ID in DB
    const [game] = await db
      .select({ id: games.id, steamAppId: games.steamAppId, title: games.title })
      .from(games)
      .where(eq(games.steamAppId, numId))
      .limit(1)

    return {
      steamAppId: numId,
      title: game?.title ?? null,
      dbId: game?.id ?? null,
    }
  }

  // Try UUID
  const [game] = await db
    .select({ id: games.id, steamAppId: games.steamAppId, title: games.title })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (!game || game.steamAppId === null) return null

  return {
    steamAppId: game.steamAppId,
    title: game.title,
    dbId: game.id,
  }
}

// ── Nested route: /api/games/:gameId/test-version-fetchers ──────
export const versionTestRoutes = new Elysia({
  prefix: "/games/:gameId",
  detail: { tags: ["Games"] },
}).get(
  "/test-version-fetchers",
  async ({ params, query, set }) => {
    // Support direct steamAppId override via query param
    let steamAppId: number
    let title: string | null = null
    let dbId: string | null = null

    if (query.steamAppId) {
      // Use provided Steam App ID directly
      steamAppId = Number(query.steamAppId)
    } else {
      const resolved = await resolveGame(params.gameId)
      if (!resolved) {
        set.status = 404
        return { error: "Game not found. Try passing ?steamAppId=730 directly." }
      }
      steamAppId = resolved.steamAppId
      title = resolved.title
      dbId = resolved.dbId
    }

    // Run all strategies
    const results = await Promise.all(
      ALL_STRATEGIES.map(async (s) => {
        const result = await s.fn(steamAppId)
        return {
          strategy: s.name,
          versionString: result.versionString,
          buildId: result.buildId,
          success: result.success,
          error: result.error ?? null,
        }
      }),
    )

    // Determine best
    const withVersion = results.find((r) => r.versionString)
    const withBuild = results.find((r) => r.buildId)
    const best = withVersion ?? withBuild ?? null

    return {
      game: {
        id: dbId ?? params.gameId,
        title: title ?? `Steam App ${steamAppId}`,
        steamAppId,
      },
      results,
      best: best
        ? {
            strategy: best.strategy,
            versionString: best.versionString,
            buildId: best.buildId,
          }
        : null,
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
    query: t.Object({
      steamAppId: t.Optional(t.String()),
    }),
  },
)

// ── Standalone route: /api/version-test?steamAppId=730 ──────────
export const standaloneVersionTestRoutes = new Elysia({
  prefix: "/version-test",
  detail: { tags: ["Games"] },
}).get(
  "/",
  async ({ query }) => {
    const steamAppId = Number(query.steamAppId)
    if (!steamAppId || isNaN(steamAppId)) {
      return { error: "steamAppId query parameter is required (e.g., ?steamAppId=730)" }
    }

    const results = await Promise.all(
      ALL_STRATEGIES.map(async (s) => {
        const result = await s.fn(steamAppId)
        return {
          strategy: s.name,
          versionString: result.versionString,
          buildId: result.buildId,
          success: result.success,
          error: result.error ?? null,
        }
      }),
    )

    const withVersion = results.find((r) => r.versionString)
    const withBuild = results.find((r) => r.buildId)
    const best = withVersion ?? withBuild ?? null

    return {
      steamAppId,
      results,
      best: best
        ? {
            strategy: best.strategy,
            versionString: best.versionString,
            buildId: best.buildId,
          }
        : null,
    }
  },
  {
    query: t.Object({
      steamAppId: t.String(),
    }),
  },
)

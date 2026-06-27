import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { fetchAllVersions, SERVER_STRATEGIES, CLIENT_STRATEGIES, type VersionFetchResult } from "@/lib/version-fetchers/index"

export const steamdbVersionRoutes = new Elysia({
  prefix: "/games/:gameId",
  detail: { tags: ["Games"] },
}).get(
  "/steamdb-version",
  async ({ params, set }) => {
    // Look up game — supports both DB UUID and numeric Steam App ID
    const isNumeric = /^\d+$/.test(params.gameId)
    let steamAppId: number | null = null

    if (isNumeric) {
      // Already a Steam App ID — use directly
      steamAppId = Number(params.gameId)
    } else {
      // Look up by DB UUID
      const [game] = await db
        .select({ steamAppId: games.steamAppId })
        .from(games)
        .where(eq(games.id, params.gameId))
        .limit(1)

      if (!game) {
        set.status = 404
        return { error: "Game not found" }
      }
      steamAppId = game.steamAppId
    }

    if (steamAppId === null) {
      return { unavailable: true, reason: "no_steam_app_id" }
    }

    // Run ONLY server-safe strategies (no client-preferred ones)
    // Client-side strategies should be called from the browser
    const { best, all } = await fetchAllVersions(
      steamAppId,
      SERVER_STRATEGIES,
    )

    // If server strategies found nothing, tell the client which strategies to try
    const clientStrategies = best.versionString || best.buildId
      ? [] // Server got something, client doesn't need to try more
      : CLIENT_STRATEGIES.map((s) => s.name) // Server got nothing, suggest client try these

    if (best.versionString === null && best.buildId === null && clientStrategies.length === 0) {
      return {
        unavailable: true,
        reason: "not_found",
        results: all.map((r) => ({
          source: r.source,
          success: r.success,
          error: r.error,
        })),
      }
    }

    return {
      versionString: best.versionString,
      buildId: best.buildId,
      steamAppId,
      source: best.source,
      clientStrategies,
      // Include detailed results for debugging
      results: all.map((r) => ({
        source: r.source,
        versionString: r.versionString,
        buildId: r.buildId,
        success: r.success,
        error: r.error,
      })),
      // If server didn't find named version, tell client to try
      needsClientFetch: clientStrategies.length > 0,
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
  },
)

/**
 * Client-friendly version fetch endpoint.
 * POST /api/games/:gameId/fetch-version-client
 *
 * Accepts results from client-side strategies and merges with server results.
 * The client calls this after running client-side strategies in the browser.
 */
export const clientVersionRoutes = new Elysia({
  prefix: "/games/:gameId",
  detail: { tags: ["Games"] },
}).post(
  "/fetch-version-client",
  async ({ params, body, set }) => {
    // Look up game — supports both DB UUID and numeric Steam App ID
    const isNumeric = /^\d+$/.test(params.gameId)
    let steamAppId: number | null = null

    if (isNumeric) {
      steamAppId = Number(params.gameId)
    } else {
      const [game] = await db
        .select({ steamAppId: games.steamAppId })
        .from(games)
        .where(eq(games.id, params.gameId))
        .limit(1)

      if (!game) {
        set.status = 404
        return { error: "Game not found" }
      }
      steamAppId = game.steamAppId
    }

    if (steamAppId === null) {
      return { unavailable: true, reason: "no_steam_app_id" }
    }

    // Run server strategies
    const { best: serverBest } = await fetchAllVersions(
      steamAppId,
      SERVER_STRATEGIES,
    )

    // Merge with client results
    const clientResults: VersionFetchResult[] = (body.clientResults ?? []).map(
      (r: { source: string; versionString: string | null; buildId: string | null; success: boolean; error?: string }) => ({
        ...r,
      }),
    )

    const allResults = [
      ...SERVER_STRATEGIES.map((s) => {
        const existing = clientResults.find((r) => r.source === s.name)
        return existing ?? { versionString: null, buildId: null, source: s.name, success: false }
      }),
      ...clientResults.filter((r) => !SERVER_STRATEGIES.some((s) => s.name === r.source)),
    ]

    // Find best: prefer versionString > buildId
    let best: VersionFetchResult = serverBest
    for (const r of allResults) {
      if (r.versionString && !best.versionString) best = r
      if (!best.versionString && !best.buildId && r.buildId) best = r
    }

    return {
      versionString: best.versionString,
      buildId: best.buildId,
      source: best.source,
      allResults,
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
    body: t.Object({
      clientResults: t.Array(
        t.Object({
          source: t.String(),
          versionString: t.Nullable(t.String()),
          buildId: t.Nullable(t.String()),
          success: t.Boolean(),
          error: t.Optional(t.String()),
        }),
      ),
    }),
  },
)

import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  hardware,
  user,
} from "@/lib/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"

// ── Pure helpers (unit-tested directly) ──────────────────────────

export type PluginGameRow = {
  id: string
  steamAppId: number | null
  title: string
  slug: string | null
}
export type PluginEntryRow = {
  id: string
  hardwareSlug: string
  fpsAvg: number
  fpsLow: number | null
  fpsOnePercentLow: number | null
  fpsHigh: number | null
  upscalerType: string
  frameGenMethod: string
  protonVersion: string | null
  osVersion: string | null
  tdpWatts: number | null
  settingsJson: unknown
  upvotes: number
  isPinned: boolean
  createdAt: Date
  userName: string | null
  userImage: string | null
}

export type PluginGameResponse = {
  game: { id: string; steamAppId: number | null; title: string; slug: string | null } | null
  estFps: { avg: number; low: number | null; onePct: number | null; high: number | null; count: number; tdpAvg: number | null } | null
  topEntries: ReturnType<typeof trimEntry>[]
  recentEntries: ReturnType<typeof trimEntry>[]
  error?: string
}

function trimEntry(e: PluginEntryRow) {
  return {
    id: e.id,
    hardwareSlug: e.hardwareSlug,
    fpsAvg: e.fpsAvg,
    fpsLow: e.fpsLow,
    fpsOnePercentLow: e.fpsOnePercentLow,
    fpsHigh: e.fpsHigh,
    upscalerType: e.upscalerType,
    frameGenMethod: e.frameGenMethod,
    protonVersion: e.protonVersion,
    osVersion: e.osVersion,
    tdpWatts: e.tdpWatts,
    settingsJson: e.settingsJson,
    upvotes: e.upvotes,
    isPinned: e.isPinned,
    createdAt: e.createdAt.toISOString(),
    userName: e.userName,
    userImage: e.userImage,
  }
}

export async function buildPluginGameResponse(args: {
  game: PluginGameRow | null
  entries?: PluginEntryRow[]
  recent?: PluginEntryRow[]
  estFps?: { avg: number; low: number | null; onePct: number | null; high: number | null; count: number; tdpAvg: number | null } | null
}): Promise<PluginGameResponse> {
  if (!args.game) {
    return { game: null, estFps: null, topEntries: [], recentEntries: [] }
  }
  const entries = args.entries ?? []
  const recent = args.recent ?? []
  // Use provided estFps if available, otherwise compute from entries
  const estFps = args.estFps ?? (entries.length > 0 ? {
    avg: Math.round((entries.reduce((a, b) => a + b.fpsAvg, 0) / entries.length) * 10) / 10,
    low: entries.reduce<number | null>((m, e) => (m == null ? e.fpsLow : Math.min(m, e.fpsLow ?? m)), null),
    onePct: entries.reduce<number | null>((m, e) => (m == null ? e.fpsOnePercentLow : Math.min(m, e.fpsOnePercentLow ?? m)), null),
    high: entries.reduce<number | null>((m, e) => (m == null ? e.fpsHigh : Math.max(m, e.fpsHigh ?? m)), null),
    count: entries.length,
    tdpAvg: entries.length > 0
      ? Math.round((entries.filter((e) => e.tdpWatts != null).reduce((a, b) => a + (b.tdpWatts ?? 0), 0) / Math.max(1, entries.filter((e) => e.tdpWatts != null).length)) * 10) / 10
      : null,
  } : null)
  if (!estFps) {
    return { game: { ...args.game }, estFps: null, topEntries: [], recentEntries: [] }
  }
  const topEntries = entries.map(trimEntry)
  const recentEntries = recent.map(trimEntry)
  return { game: { ...args.game }, estFps, topEntries, recentEntries }
}

// ── Route ────────────────────────────────────────────────────────

export const pluginPublicRoutes = new Elysia({
  prefix: "/plugin",
  detail: { tags: ["Plugin"] },
})
  .get(
    "/game/:steamAppId",
    async ({ params, query, set }) => {
      const steamAppId = Number(params.steamAppId)
      if (!Number.isInteger(steamAppId) || steamAppId <= 0) {
        set.status = 400
        return { error: "Invalid steamAppId" }
      }

      const [game] = await db
        .select({
          id: games.id,
          steamAppId: games.steamAppId,
          title: games.title,
          slug: games.slug,
        })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1)

      if (!game) {
        set.status = 404
        return await buildPluginGameResponse({ game: null })
      }

      // Resolve latest version
      const [latestVersion] = await db
        .select({ id: gameVersions.id })
        .from(gameVersions)
        .where(and(eq(gameVersions.gameId, game.id), eq(gameVersions.isLatest, true)))
        .limit(1)

      let versionId = latestVersion?.id
      if (!versionId) {
        const [anyVersion] = await db
          .select({ id: gameVersions.id })
          .from(gameVersions)
          .where(eq(gameVersions.gameId, game.id))
          .orderBy(gameVersions.createdAt)
          .limit(1)
        versionId = anyVersion?.id
      }
      if (!versionId) {
        return await buildPluginGameResponse({ game, entries: [], recent: [] })
      }

      const hardwareFilter = query.hardware ? eq(performanceEntries.hardwareSlug, query.hardware) : undefined
      const baseWhere = and(
        eq(performanceEntries.versionId, versionId),
        eq(performanceEntries.isRemoved, false),
        ...(hardwareFilter ? [hardwareFilter] : []),
      )

      // Top entries: pinned -> upvotes
      const topRows = await db
        .select({
          id: performanceEntries.id,
          hardwareSlug: performanceEntries.hardwareSlug,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
          fpsHigh: performanceEntries.fpsHigh,
          upscalerType: performanceEntries.upscalerType,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          tdpWatts: performanceEntries.tdpWatts,
          settingsJson: performanceEntries.settingsJson,
          upvotes: performanceEntries.upvotes,
          isPinned: performanceEntries.isPinned,
          createdAt: performanceEntries.createdAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(performanceEntries)
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .where(baseWhere)
        .orderBy(desc(performanceEntries.isPinned), desc(performanceEntries.upvotes))
        .limit(query.limit ?? 3)

      // Recent entries
      const recentRows = await db
        .select({
          id: performanceEntries.id,
          hardwareSlug: performanceEntries.hardwareSlug,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
          fpsHigh: performanceEntries.fpsHigh,
          upscalerType: performanceEntries.upscalerType,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          tdpWatts: performanceEntries.tdpWatts,
          settingsJson: performanceEntries.settingsJson,
          upvotes: performanceEntries.upvotes,
          isPinned: performanceEntries.isPinned,
          createdAt: performanceEntries.createdAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(performanceEntries)
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .where(baseWhere)
        .orderBy(desc(performanceEntries.createdAt))
        .limit(query.limit ?? 3)

      // Aggregate estFps from ALL matching entries (not just top-3)
      const [agg] = await db
        .select({
          avg: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
          low: sql<number | null>`min(${performanceEntries.fpsLow})`,
          onePct: sql<number | null>`min(${performanceEntries.fpsOnePercentLow})`,
          high: sql<number | null>`max(${performanceEntries.fpsHigh})`,
          count: sql<number>`count(*)::int`,
          tdpAvg: sql<number | null>`round(avg(${performanceEntries.tdpWatts})::numeric, 1)`,
        })
        .from(performanceEntries)
        .where(baseWhere)

      set.headers["Cache-Control"] = "public, max-age=60"
      set.headers["Vary"] = "search-params"
      return await buildPluginGameResponse({
        game,
        entries: topRows as unknown as PluginEntryRow[],
        recent: recentRows as unknown as PluginEntryRow[],
        estFps: agg.avg ? { avg: agg.avg, low: agg.low, onePct: agg.onePct, high: agg.high, count: agg.count, tdpAvg: agg.tdpAvg ?? null } : null,
      })
    },
    {
      params: t.Object({ steamAppId: t.Numeric() }),
      query: t.Object({
        hardware: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        description:
          "Public read endpoint for the DeckyVault Decky plugin's library app-details panel. " +
          "Returns game status, device-scoped estimated FPS, and top/recent entries.",
      },
    },
  )
  .get(
    "/game/:steamAppId/devices",
    async ({ params, set }) => {
      const steamAppId = Number(params.steamAppId)
      if (!Number.isInteger(steamAppId) || steamAppId <= 0) {
        set.status = 400
        return { error: "Invalid steamAppId", devices: [] }
      }
      const [game] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1)
      if (!game) {
        set.status = 404
        return { error: "Game not in DeckyVault", devices: [] }
      }
      const rows = await db
        .select({
          slug: performanceEntries.hardwareSlug,
          count: sql<number>`count(*)::int`,
          name: hardware.name,
        })
        .from(performanceEntries)
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(
          and(
            eq(gameVersions.gameId, game.id),
            eq(gameVersions.isLatest, true),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .groupBy(performanceEntries.hardwareSlug, hardware.name)
        .orderBy(desc(sql`count(*)`))
      set.headers["Cache-Control"] = "public, max-age=60"
      set.headers["Vary"] = "search-params"
      return { devices: rows }
    },
    {
      params: t.Object({ steamAppId: t.Numeric() }),
    },
  )
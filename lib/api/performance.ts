import { Elysia, t } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { performanceEntries, games, gameVersions } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { eq, and, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

// ── Performance Entries CRUD ──────────────────────────────────────
export const performanceRoutes = createCrudRoutes(performanceEntries, {
  prefix: "/performance",
  name: "Performance Entry",
  auth: { read: "public", write: "user", delete: "admin" },
  softDelete: true,
  search: { fields: ["userNotes"] },
  filter: { fields: ["hardwareSlug", "fsrVersion", "frameGenMethod"] },
})

// ── Verify endpoint (admin/mod) ───────────────────────────────────
export const performanceVerifyRoutes = new Elysia({
  prefix: "/performance",
})
  .post(
    "/:id/verify",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, ["contributor", "admin"])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [entry] = await db
        .select()
        .from(performanceEntries)
        .where(eq(performanceEntries.id, params.id))
        .limit(1)

      if (!entry) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      if (entry.verifiedAt) {
        set.status = 409
        return { error: "Entry already verified" }
      }

      const [updated] = await db
        .update(performanceEntries)
        .set({
          verifiedAt: new Date(),
          verifiedBy: guard.user.id,
          updatedAt: new Date(),
        })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // ── Stats endpoint: aggregated performance for a game+hardware combo ──
  .get(
    "/stats",
    async ({ query, set }) => {
      const { gameId, hardwareSlug, fsrVersion } = query as {
        gameId?: string
        hardwareSlug?: string
        fsrVersion?: string
      }

      if (!gameId) {
        set.status = 400
        return { error: "gameId query parameter is required" }
      }

      const conditions = [
        eq(games.id, gameId),
        eq(performanceEntries.isRemoved, false),
      ]

      if (hardwareSlug) {
        conditions.push(eq(performanceEntries.hardwareSlug, hardwareSlug))
      }
      if (fsrVersion) {
        conditions.push(eq(performanceEntries.fsrVersion, fsrVersion as any)) // eslint-disable-line @typescript-eslint/no-explicit-any
      }

      // Join through gameVersions to get to games
      const stats = await db
        .select({
          count: sql<number>`count(*)::int`,
          fpsAvg: sql<number>`avg(${performanceEntries.fpsAvg})::real`,
          fpsLow: sql<number>`percentile_cont(0.1) within group (order by ${performanceEntries.fpsAvg})::real`,
          fpsHigh: sql<number>`percentile_cont(0.9) within group (order by ${performanceEntries.fpsAvg})::real`,
        })
        .from(performanceEntries)
        .innerJoin(
          gameVersions,
          eq(performanceEntries.versionId, gameVersions.id),
        )
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .where(and(...conditions))

      return stats[0] ?? { count: 0, fpsAvg: null, fpsLow: null, fpsHigh: null }
    },
    {
      query: t.Object({
        gameId: t.String(),
        hardwareSlug: t.Optional(t.String()),
        fsrVersion: t.Optional(t.String()),
      }),
    },
  )

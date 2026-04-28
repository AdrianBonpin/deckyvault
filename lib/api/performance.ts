import { Elysia, t } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { performanceEntries, games, gameVersions, hardware, user } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { eq, and, desc, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

// ── Performance Entries CRUD ──────────────────────────────────────
export const performanceRoutes = createCrudRoutes(performanceEntries, {
  prefix: "/performance",
  name: "Performance Entry",
  auth: { read: "public", write: "user", delete: "admin" },
  softDelete: true,
  search: { fields: ["userNotes"] },
  filter: { fields: ["hardwareSlug", "upscalerType", "upscalerVersion", "frameGenMethod"] },
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
  // ── Upvote ────────────────────────────────────────────────────────
  .post(
    "/:id/upvote",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [updated] = await db
        .update(performanceEntries)
        .set({
          upvotes: sql`${performanceEntries.upvotes} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(performanceEntries.id, params.id),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // ── Downvote ──────────────────────────────────────────────────────
  .post(
    "/:id/downvote",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [updated] = await db
        .update(performanceEntries)
        .set({
          downvotes: sql`${performanceEntries.downvotes} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(performanceEntries.id, params.id),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // ── Pin a preset (admin only) ──────────────────────────────────────
  .post(
    "/:id/pin",
    async ({ request, params, set }) => {
      const guard = await requireRole(request.headers, ["admin"])
      if (!guard.ok) { set.status = guard.status; return { error: guard.error } }

      const [entry] = await db
        .update(performanceEntries)
        .set({ isPinned: true, pinnedAt: new Date() })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      if (!entry) { set.status = 404; return { error: "Entry not found" } }
      return { entry }
    },
    { params: t.Object({ id: t.String() }) },
  )
  // ── Unpin a preset (admin only) ────────────────────────────────────
  .delete(
    "/:id/pin",
    async ({ request, params, set }) => {
      const guard = await requireRole(request.headers, ["admin"])
      if (!guard.ok) { set.status = guard.status; return { error: guard.error } }

      const [entry] = await db
        .update(performanceEntries)
        .set({ isPinned: false, pinnedAt: null })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      if (!entry) { set.status = 404; return { error: "Entry not found" } }
      return { entry }
    },
    { params: t.Object({ id: t.String() }) },
  )
  // ── User-scoped soft delete (owner or admin) ────────────────────
  .delete(
    "/:id/user-delete",
    async ({ params, body, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [entry] = await db
        .select({
          id: performanceEntries.id,
          userId: performanceEntries.userId,
        })
        .from(performanceEntries)
        .where(eq(performanceEntries.id, params.id))
        .limit(1)

      if (!entry) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      if (entry.userId !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized to delete this entry" }
      }

      const reason = body?.reason as string | undefined

      const [updated] = await db
        .update(performanceEntries)
        .set({
          isRemoved: true,
          removedReason: reason ?? "User deleted",
          updatedAt: new Date(),
        })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      return { success: true }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
    },
  )
  // ── Edit entry (owner or admin) ───────────────────────────────────
  .patch(
    "/:id/edit",
    async ({ params, body, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [entry] = await db
        .select({
          id: performanceEntries.id,
          userId: performanceEntries.userId,
        })
        .from(performanceEntries)
        .where(eq(performanceEntries.id, params.id))
        .limit(1)

      if (!entry) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      if (entry.userId !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized to edit this entry" }
      }

      const updateData: Partial<typeof performanceEntries.$inferInsert> = {
        updatedAt: new Date(),
      }

      if (body.fpsAvg !== undefined) updateData.fpsAvg = body.fpsAvg
      if (body.fpsOnePercentLow !== undefined) updateData.fpsOnePercentLow = body.fpsOnePercentLow
      if (body.fpsLow !== undefined) updateData.fpsLow = body.fpsLow
      if (body.fpsHigh !== undefined) updateData.fpsHigh = body.fpsHigh
      if (body.protonVersion !== undefined)
        updateData.protonVersion = body.protonVersion
      if (body.osVersion !== undefined)
        updateData.osVersion = body.osVersion
      if (body.upscalerType !== undefined)
        updateData.upscalerType = body.upscalerType ?? "none"
      if (body.upscalerVersion !== undefined)
        updateData.upscalerVersion = body.upscalerVersion
      if (body.frameGenMethod !== undefined)
        updateData.frameGenMethod = body.frameGenMethod ?? "none"
      if (body.launchOptions !== undefined)
        updateData.launchOptions = body.launchOptions
      if (body.settingsJson !== undefined)
        updateData.settingsJson = body.settingsJson
      if (body.userNotes !== undefined)
        updateData.userNotes = body.userNotes

      const [updated] = await db
        .update(performanceEntries)
        .set(updateData)
        .where(eq(performanceEntries.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        fpsAvg: t.Optional(t.Number()),
        fpsOnePercentLow: t.Optional(t.Number()),
        fpsLow: t.Optional(t.Number()),
        fpsHigh: t.Optional(t.Number()),
        protonVersion: t.Optional(t.Union([t.String(), t.Null()])),
        osVersion: t.Optional(t.Union([t.String(), t.Null()])),
        upscalerType: t.Optional(
          t.Union([
            t.Literal("none"),
            t.Literal("fsr"),
            t.Literal("dlss"),
            t.Literal("xess"),
            t.Literal("lsfg"),
            t.Literal("other"),
            t.Null(),
          ]),
        ),
        upscalerVersion: t.Optional(t.Union([t.String(), t.Null()])),
        frameGenMethod: t.Optional(
          t.Union([
            t.Literal("none"),
            t.Literal("fsr_fg"),
            t.Literal("dlss_fg"),
            t.Literal("lsfg"),
            t.Literal("other"),
            t.Null(),
          ]),
        ),
        launchOptions: t.Optional(t.Union([t.String(), t.Null()])),
        settingsJson: t.Optional(t.Union([t.Array(t.Any()), t.Null()])),
        userNotes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  // ── Best entry: highest-rated for latest version ──────────────────
  .get(
    "/best",
    async ({ query, set }) => {
      const { gameId, hardwareSlug } = query as {
        gameId?: string
        hardwareSlug?: string
      }

      if (!gameId) {
        set.status = 400
        return { error: "gameId query parameter is required" }
      }

      // Find the latest version for this game
      const [latestVersion] = await db
        .select()
        .from(gameVersions)
        .where(
          and(eq(gameVersions.gameId, gameId), eq(gameVersions.isLatest, true)),
        )
        .limit(1)

      if (!latestVersion) {
        set.status = 404
        return { error: "No versions found for this game" }
      }

      const conditions = [
        eq(performanceEntries.versionId, latestVersion.id),
        eq(performanceEntries.isRemoved, false),
      ]

      if (hardwareSlug) {
        conditions.push(eq(performanceEntries.hardwareSlug, hardwareSlug))
      }

      const [bestEntry] = await db
        .select({
          id: performanceEntries.id,
          versionId: performanceEntries.versionId,
          hardwareSlug: performanceEntries.hardwareSlug,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          upscalerType: performanceEntries.upscalerType,
          upscalerVersion: performanceEntries.upscalerVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          settingsJson: performanceEntries.settingsJson,
          userNotes: performanceEntries.userNotes,
          upvotes: performanceEntries.upvotes,
          downvotes: performanceEntries.downvotes,
          verifiedAt: performanceEntries.verifiedAt,
          createdAt: performanceEntries.createdAt,
          userName: user.name,
          userImage: user.image,
          hardwareName: hardware.name,
          versionString: gameVersions.versionString,
        })
        .from(performanceEntries)
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(and(...conditions))
        .orderBy(
          desc(
            sql`${performanceEntries.upvotes} - ${performanceEntries.downvotes}`,
          ),
          desc(performanceEntries.upvotes),
        )
        .limit(1)

      if (!bestEntry) {
        set.status = 404
        return { error: "No performance entries found" }
      }

      return bestEntry
    },
    {
      query: t.Object({
        gameId: t.String(),
        hardwareSlug: t.Optional(t.String()),
      }),
    },
  )
  // ── Stats endpoint: aggregated performance for a game+hardware combo ──
  .get(
    "/stats",
    async ({ query, set }) => {
      const { gameId, hardwareSlug, upscalerType, upscalerVersion } = query as {
        gameId?: string
        hardwareSlug?: string
        upscalerType?: string
        upscalerVersion?: string
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
      if (upscalerType) {
        conditions.push(eq(performanceEntries.upscalerType, upscalerType as any)) // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      if (upscalerVersion) {
        conditions.push(eq(performanceEntries.upscalerVersion, upscalerVersion))
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
        upscalerType: t.Optional(t.String()),
        upscalerVersion: t.Optional(t.String()),
      }),
    },
  )

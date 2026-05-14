import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  performanceEntries,
  gameVersions,
  games,
  hardware,
  user,
} from "@/lib/db/schema"
import { eq, desc, sql, and, ilike, isNull, isNotNull, or } from "drizzle-orm"
import { fuzzySearchTerm } from "@/lib/db/search"
import {
  requireContributorOrAdmin,
  requireAdmin,
} from "@/lib/auth/guard"

export const adminPerformanceRoutes = new Elysia({ prefix: "/admin", detail: { tags: ["Admin"] } })
  .get(
    "/performance",
    async ({ query, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0
      const removedFilter = query.removed
      const verifiedFilter = query.verified
      const searchTerm = query.search

      const conditions: (ReturnType<typeof eq> | ReturnType<typeof ilike> | ReturnType<typeof isNull> | ReturnType<typeof isNotNull> | ReturnType<typeof and>)[] = []

      if (removedFilter === "true") {
        conditions.push(eq(performanceEntries.isRemoved, true))
      } else if (removedFilter === "false") {
        conditions.push(eq(performanceEntries.isRemoved, false))
      }

      if (verifiedFilter === "true") {
        conditions.push(isNotNull(performanceEntries.verifiedAt))
      } else if (verifiedFilter === "false") {
        conditions.push(isNull(performanceEntries.verifiedAt))
      }

      if (searchTerm) {
        conditions.push(
          or(
            ilike(user.name, `%${searchTerm}%`),
            ilike(games.title, fuzzySearchTerm(searchTerm)),
          ),
        )
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const baseQuery = db
        .select({
          id: performanceEntries.id,
          versionId: performanceEntries.versionId,
          hardwareSlug: performanceEntries.hardwareSlug,
          userId: performanceEntries.userId,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          upscalerType: performanceEntries.upscalerType,
          upscalerVersion: performanceEntries.upscalerVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          loadTimeSsd: performanceEntries.loadTimeSsd,
          loadTimeSd: performanceEntries.loadTimeSd,
          launchOptions: performanceEntries.launchOptions,
          settingsJson: performanceEntries.settingsJson,
          userNotes: performanceEntries.userNotes,
          customSystem: performanceEntries.customSystem,
          isRemoved: performanceEntries.isRemoved,
          removedReason: performanceEntries.removedReason,
          upvotes: performanceEntries.upvotes,
          downvotes: performanceEntries.downvotes,
          verifiedAt: performanceEntries.verifiedAt,
          verifiedBy: performanceEntries.verifiedBy,
          createdAt: performanceEntries.createdAt,
          updatedAt: performanceEntries.updatedAt,
          gameId: games.id,
          gameTitle: games.title,
          versionString: gameVersions.versionString,
          hardwareName: hardware.name,
          authorName: user.name,
          authorImage: user.image,
        })
        .from(performanceEntries)
        .innerJoin(
          gameVersions,
          eq(performanceEntries.versionId, gameVersions.id),
        )
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .innerJoin(
          hardware,
          eq(performanceEntries.hardwareSlug, hardware.slug),
        )
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .orderBy(desc(performanceEntries.createdAt))

      const items = whereClause
        ? await baseQuery.where(whereClause).limit(limit).offset(offset)
        : await baseQuery.limit(limit).offset(offset)

      const countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .innerJoin(
          gameVersions,
          eq(performanceEntries.versionId, gameVersions.id),
        )
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .innerJoin(
          hardware,
          eq(performanceEntries.hardwareSlug, hardware.slug),
        )
        .innerJoin(user, eq(performanceEntries.userId, user.id))

      const countResult = whereClause
        ? await countQuery.where(whereClause)
        : await countQuery

      const total = countResult[0]?.count ?? 0

      return {
        data: items,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        removed: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
        verified: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
        search: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/performance/:id/verify",
    async ({ params, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers)
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
  .patch(
    "/performance/:id/remove",
    async ({ params, body, request, set }) => {
      const guard = await requireAdmin(request.headers)
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

      const [updated] = await db
        .update(performanceEntries)
        .set({
          isRemoved: true,
          removedReason: body?.reason ?? "Admin removed",
          updatedAt: new Date(),
        })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(
        t.Object({
          reason: t.Optional(t.String()),
        }),
      ),
    },
  )
  .delete(
    "/performance/:id/hard-delete",
    async ({ params, request, set }) => {
      const guard = await requireAdmin(request.headers)
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

      await db
        .delete(performanceEntries)
        .where(eq(performanceEntries.id, params.id))

      return { success: true }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .patch(
    "/performance/:id/restore",
    async ({ params, request, set }) => {
      const guard = await requireAdmin(request.headers)
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

      const [updated] = await db
        .update(performanceEntries)
        .set({
          isRemoved: false,
          removedReason: null,
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

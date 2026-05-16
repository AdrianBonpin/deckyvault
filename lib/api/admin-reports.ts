import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  reports,
  performanceEntries,
  gameVersions,
  games,
  user,
} from "@/lib/db/schema"
import { eq, desc, sql, and, inArray } from "drizzle-orm"
import { requireModeratorOrAdmin } from "@/lib/auth/guard"

export const adminReportRoutes = new Elysia({ prefix: "/admin", detail: { tags: ["Admin"] } })
  .get(
    "/reports",
    async ({ query, request, set }) => {
      const guard = await requireModeratorOrAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0
      const statusFilter = query.status

      const conditions = []
      if (
        statusFilter &&
        ["open", "reviewed", "dismissed"].includes(statusFilter)
      ) {
        conditions.push(
          eq(reports.status, statusFilter as "open" | "reviewed" | "dismissed"),
        )
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined

      const baseQuery = db
        .select({
          report: {
            id: reports.id,
            entryId: reports.entryId,
            reporterId: reports.reporterId,
            reason: reports.reason,
            details: reports.details,
            status: reports.status,
            createdAt: reports.createdAt,
          },
          reporterName: user.name,
          entry: {
            id: performanceEntries.id,
            userId: performanceEntries.userId,
            fpsAvg: performanceEntries.fpsAvg,
            fpsLow: performanceEntries.fpsLow,
            fpsHigh: performanceEntries.fpsHigh,
            upscalerType: performanceEntries.upscalerType,
            userNotes: performanceEntries.userNotes,
            isRemoved: performanceEntries.isRemoved,
          },
          gameVersion: {
            id: gameVersions.id,
            versionString: gameVersions.versionString,
          },
          game: {
            id: games.id,
            title: games.title,
            headerImage: games.headerImage,
          },
        })
        .from(reports)
        .innerJoin(
          performanceEntries,
          eq(reports.entryId, performanceEntries.id),
        )
        .innerJoin(
          gameVersions,
          eq(performanceEntries.versionId, gameVersions.id),
        )
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .innerJoin(user, eq(reports.reporterId, user.id))
        .orderBy(desc(reports.createdAt))

      const items = whereClause
        ? await baseQuery.where(whereClause).limit(limit).offset(offset)
        : await baseQuery.limit(limit).offset(offset)

      const countResult = whereClause
        ? await db
            .select({ count: sql<number>`count(*)::int` })
            .from(reports)
            .where(whereClause)
        : await db.select({ count: sql<number>`count(*)::int` }).from(reports)

      const total = countResult[0]?.count ?? 0

      // Batch-fetch entry author names
      const authorIds = [...new Set(items.map((i) => i.entry.userId))]
      const authorNames: Record<string, string | null> = {}

      if (authorIds.length > 0) {
        const authors = await db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(inArray(user.id, authorIds))

        for (const a of authors) {
          authorNames[a.id] = a.name
        }
      }

      return {
        data: items.map((item) => ({
          ...item.report,
          createdAt: item.report.createdAt.toISOString(),
          reporterName: item.reporterName,
          entry: {
            ...item.entry,
            authorName: authorNames[item.entry.userId] ?? null,
          },
          gameVersion: item.gameVersion,
          game: item.game,
        })),
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("open"),
            t.Literal("reviewed"),
            t.Literal("dismissed"),
          ]),
        ),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/reports/:id/status",
    async ({ params, body, request, set }) => {
      const guard = await requireModeratorOrAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [existing] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, params.id))
        .limit(1)

      if (!existing) {
        set.status = 404
        return { error: "Report not found" }
      }

      if (existing.status === body.status) {
        set.status = 409
        return { error: "Report already has this status" }
      }

      if (body.status === "reviewed") {
        await db
          .update(performanceEntries)
          .set({
            isRemoved: true,
            removedReason: `Reported: ${existing.reason}${existing.details ? ` — ${existing.details}` : ""}`,
            updatedAt: new Date(),
          })
          .where(eq(performanceEntries.id, existing.entryId))
      }

      const [updated] = await db
        .update(reports)
        .set({ status: body.status })
        .where(eq(reports.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([t.Literal("reviewed"), t.Literal("dismissed")]),
      }),
    },
  )

import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  gameComments,
  games,
  user,
} from "@/lib/db/schema"
import { eq, desc, sql, and, ilike } from "drizzle-orm"
import {
  requireContributorOrAdmin,
  requireAdmin,
} from "@/lib/auth/guard"

export const adminCommentRoutes = new Elysia({ prefix: "/admin", detail: { tags: ["Admin"] } })
  .get(
    "/comments",
    async ({ query, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0
      const removedFilter = query.removed
      const searchTerm = query.search

      const conditions: (ReturnType<typeof eq> | ReturnType<typeof ilike> | ReturnType<typeof and>)[] = []

      if (removedFilter === "true") {
        conditions.push(eq(gameComments.isRemoved, true))
      } else if (removedFilter === "false") {
        conditions.push(eq(gameComments.isRemoved, false))
      }

      if (searchTerm) {
        conditions.push(ilike(user.name, `%${searchTerm}%`))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const baseQuery = db
        .select({
          id: gameComments.id,
          gameId: gameComments.gameId,
          content: gameComments.content,
          upvotes: gameComments.upvotes,
          isRemoved: gameComments.isRemoved,
          createdAt: gameComments.createdAt,
          updatedAt: gameComments.updatedAt,
          userId: gameComments.userId,
          userName: user.name,
          userImage: user.image,
          gameTitle: games.title,
          parentId: gameComments.parentId,
        })
        .from(gameComments)
        .innerJoin(games, eq(gameComments.gameId, games.id))
        .innerJoin(user, eq(gameComments.userId, user.id))
        .orderBy(desc(gameComments.createdAt))

      const items = whereClause
        ? await baseQuery.where(whereClause).limit(limit).offset(offset)
        : await baseQuery.limit(limit).offset(offset)

      const countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameComments)
        .innerJoin(games, eq(gameComments.gameId, games.id))
        .innerJoin(user, eq(gameComments.userId, user.id))

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
        search: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/comments/:id/remove",
    async ({ params, request, set }) => {
      const guard = await requireAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [comment] = await db
        .select()
        .from(gameComments)
        .where(eq(gameComments.id, params.id))
        .limit(1)

      if (!comment) {
        set.status = 404
        return { error: "Comment not found" }
      }

      const [updated] = await db
        .update(gameComments)
        .set({
          isRemoved: true,
          updatedAt: new Date(),
        })
        .where(eq(gameComments.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .patch(
    "/comments/:id/restore",
    async ({ params, request, set }) => {
      const guard = await requireAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [comment] = await db
        .select()
        .from(gameComments)
        .where(eq(gameComments.id, params.id))
        .limit(1)

      if (!comment) {
        set.status = 404
        return { error: "Comment not found" }
      }

      const [updated] = await db
        .update(gameComments)
        .set({
          isRemoved: false,
          updatedAt: new Date(),
        })
        .where(eq(gameComments.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

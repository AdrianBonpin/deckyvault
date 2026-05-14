import { Elysia, t } from "elysia"
import { gameComments, user } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { eq, and, desc, sql, isNull } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

export const commentsRoutes = new Elysia({
  prefix: "/games/:gameId/comments",
  detail: { tags: ["Comments"] },
})
  // LIST top-level comments for a game (paginated)
  .get(
    "/",
    async ({ params, query }) => {
      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0

      const conditions = [
        eq(gameComments.gameId, params.gameId),
        eq(gameComments.isRemoved, false),
        isNull(gameComments.parentId), // top-level only
      ]

      const data = await db
        .select({
          id: gameComments.id,
          gameId: gameComments.gameId,
          userId: gameComments.userId,
          parentId: gameComments.parentId,
          content: gameComments.content,
          upvotes: gameComments.upvotes,
          createdAt: gameComments.createdAt,
          updatedAt: gameComments.updatedAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(gameComments)
        .innerJoin(user, eq(gameComments.userId, user.id))
        .where(and(...conditions))
        .orderBy(desc(gameComments.createdAt))
        .limit(limit)
        .offset(offset)

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameComments)
        .where(and(...conditions))

      return { data, total: count, limit, offset }
    },
    {
      params: t.Object({ gameId: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  // GET replies for a specific comment
  .get(
    "/:id/replies",
    async ({ params, query }) => {
      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0

      const data = await db
        .select({
          id: gameComments.id,
          gameId: gameComments.gameId,
          userId: gameComments.userId,
          parentId: gameComments.parentId,
          content: gameComments.content,
          upvotes: gameComments.upvotes,
          createdAt: gameComments.createdAt,
          updatedAt: gameComments.updatedAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(gameComments)
        .innerJoin(user, eq(gameComments.userId, user.id))
        .where(
          and(
            eq(gameComments.parentId, params.id),
            eq(gameComments.isRemoved, false),
          ),
        )
        .orderBy(desc(gameComments.createdAt))
        .limit(limit)
        .offset(offset)

      return data
    },
    {
      params: t.Object({ gameId: t.String(), id: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  // CREATE comment
  .post(
    "/",
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

      // If parentId is provided, verify it exists and belongs to the same game
      if (body.parentId) {
        const [parent] = await db
          .select({ id: gameComments.id })
          .from(gameComments)
          .where(
            and(
              eq(gameComments.id, body.parentId),
              eq(gameComments.gameId, params.gameId),
            ),
          )
          .limit(1)

        if (!parent) {
          set.status = 404
          return { error: "Parent comment not found" }
        }
      }

      const [created] = await db
        .insert(gameComments)
        .values({
          gameId: params.gameId,
          userId: guard.user.id,
          parentId: body.parentId ?? null,
          content: body.content,
        })
        .returning()

      set.status = 201
      return created
    },
    {
      params: t.Object({ gameId: t.String() }),
      body: t.Object({
        parentId: t.Optional(t.String()),
        content: t.Record(t.String(), t.Any()), // Tiptap JSON
      }),
    },
  )
  // UPDATE comment (owner or admin)
  .patch(
    "/:id",
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

      const [comment] = await db
        .select()
        .from(gameComments)
        .where(
          and(
            eq(gameComments.id, params.id),
            eq(gameComments.gameId, params.gameId),
          ),
        )
        .limit(1)

      if (!comment) {
        set.status = 404
        return { error: "Comment not found" }
      }

      if (comment.userId !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized" }
      }

      const [updated] = await db
        .update(gameComments)
        .set({ content: body.content, updatedAt: new Date() })
        .where(eq(gameComments.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ gameId: t.String(), id: t.String() }),
      body: t.Object({
        content: t.Record(t.String(), t.Any()),
      }),
    },
  )
  // DELETE comment (soft delete — owner or admin)
  .delete(
    "/:id",
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

      const [comment] = await db
        .select()
        .from(gameComments)
        .where(
          and(
            eq(gameComments.id, params.id),
            eq(gameComments.gameId, params.gameId),
          ),
        )
        .limit(1)

      if (!comment) {
        set.status = 404
        return { error: "Comment not found" }
      }

      if (comment.userId !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized" }
      }

      await db
        .update(gameComments)
        .set({ isRemoved: true, updatedAt: new Date() })
        .where(eq(gameComments.id, params.id))

      return { success: true }
    },
    {
      params: t.Object({ gameId: t.String(), id: t.String() }),
    },
  )
  // UPVOTE comment
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
        .update(gameComments)
        .set({
          upvotes: sql`${gameComments.upvotes} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(gameComments.id, params.id),
            eq(gameComments.gameId, params.gameId),
            eq(gameComments.isRemoved, false),
          ),
        )
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Comment not found" }
      }

      return updated
    },
    {
      params: t.Object({ gameId: t.String(), id: t.String() }),
    },
  )

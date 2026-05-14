import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { savedFilters } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { requireAuth } from "@/lib/auth/guard"

export const savedFilterRoutes = new Elysia({ prefix: "/saved-filters", detail: { tags: ["Games"] } })

  // Get user's saved filters
  .get("/", async ({ request, set }) => {
    const guard = await requireAuth(request.headers)
    if (!guard.ok) {
      set.status = guard.status
      return { error: guard.error }
    }

    const filters = await db
      .select()
      .from(savedFilters)
      .where(eq(savedFilters.userId, guard.user.id))
      .orderBy(desc(savedFilters.updatedAt))

    return filters
  })

  // Create a saved filter
  .post(
    "/",
    async ({ body, request, set }) => {
      const guard = await requireAuth(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const { name, filters: filterData } = body

      const [saved] = await db
        .insert(savedFilters)
        .values({
          userId: guard.user.id,
          name,
          filters: filterData,
        })
        .returning()

      return saved
    },
    {
      body: t.Object({
        name: t.String(),
        filters: t.Record(t.String(), t.Any()),
      }),
    },
  )

  // Update a saved filter
  .patch(
    "/:id",
    async ({ params, body, request, set }) => {
      const guard = await requireAuth(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const { name, filters: filterData } = body

      // Verify ownership
      const [existing] = await db
        .select()
        .from(savedFilters)
        .where(
          and(
            eq(savedFilters.id, params.id),
            eq(savedFilters.userId, guard.user.id),
          ),
        )
        .limit(1)

      if (!existing) {
        set.status = 404
        return { error: "Saved filter not found" }
      }

      const [updated] = await db
        .update(savedFilters)
        .set({
          ...(name && { name }),
          ...(filterData && { filters: filterData }),
        })
        .where(eq(savedFilters.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        filters: t.Optional(t.Record(t.String(), t.Any())),
      }),
    },
  )

  // Delete a saved filter
  .delete(
    "/:id",
    async ({ params, request, set }) => {
      const guard = await requireAuth(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [existing] = await db
        .select()
        .from(savedFilters)
        .where(
          and(
            eq(savedFilters.id, params.id),
            eq(savedFilters.userId, guard.user.id),
          ),
        )
        .limit(1)

      if (!existing) {
        set.status = 404
        return { error: "Saved filter not found" }
      }

      await db.delete(savedFilters).where(eq(savedFilters.id, params.id))

      return { success: true }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
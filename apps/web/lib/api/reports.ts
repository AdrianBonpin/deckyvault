import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { reports } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

export const reportRoutes = new Elysia({ prefix: "/performance", detail: { tags: ["Reports"] } }).post(
  "/:id/report",
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

    // Check if user already reported this entry
    const [existing] = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.entryId, params.id),
          eq(reports.reporterId, guard.user.id),
        ),
      )
      .limit(1)

    if (existing) {
      set.status = 409
      return { error: "You have already reported this entry" }
    }

    const [created] = await db
      .insert(reports)
      .values({
        entryId: params.id,
        reporterId: guard.user.id,
        reason: body.reason,
        details: body.details ?? null,
      })
      .returning()

    return created
  },
  {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      reason: t.Union([
        t.Literal("inaccurate"),
        t.Literal("spam"),
        t.Literal("inappropriate"),
        t.Literal("other"),
      ]),
      details: t.Optional(t.String()),
    }),
  },
)

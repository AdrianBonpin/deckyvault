import { Elysia } from "elysia"
import { db } from "@/lib/db/index"
import {
  performanceEntries,
  gameVersions,
  games,
  hardware,
  user,
  gameComments,
} from "@/lib/db/schema"
import { eq, count, sql, desc } from "drizzle-orm"
import { requireModeratorOrAdmin } from "@/lib/auth/guard"

export const adminAnalyticsRoutes = new Elysia({
  prefix: "/admin/analytics",
  detail: { tags: ["Admin"] },
})

// ── Overview: time-series data for charts ────────────────────────
.get(
  "/overview",
  async ({ request, set }) => {
    const guard = await requireModeratorOrAdmin(request.headers)
    if (!guard.ok) {
      set.status = guard.status
      return { error: guard.error }
    }

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    // Benchmark submissions per day (last 90 days)
    const benchmarkTimeline = await db.execute(sql`
      SELECT
        DATE(pe.created_at) AS day,
        COUNT(*)::int AS count
      FROM performance_entries pe
      WHERE pe.created_at >= ${ninetyDaysAgo}
        AND pe.is_removed = false
      GROUP BY DATE(pe.created_at)
      ORDER BY day ASC
    `)

    // User registrations per day (last 90 days)
    const userTimeline = await db.execute(sql`
      SELECT
        DATE(u.created_at) AS day,
        COUNT(*)::int AS count
      FROM "user" u
      WHERE u.created_at >= ${ninetyDaysAgo}
      GROUP BY DATE(u.created_at)
      ORDER BY day ASC
    `)

    // Device distribution (total benchmarks per hardware)
    const deviceDistribution = await db
      .select({
        hardwareSlug: performanceEntries.hardwareSlug,
        hardwareName: hardware.name,
        count: count(),
      })
      .from(performanceEntries)
      .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
      .where(eq(performanceEntries.isRemoved, false))
      .groupBy(performanceEntries.hardwareSlug, hardware.name)
      .orderBy(desc(count()))

    // Genre popularity (top 10 genres by benchmark count)
    const genrePopularity = await db.execute(sql`
      SELECT
        genre,
        COUNT(*)::int AS count
      FROM games g
      CROSS JOIN LATERAL jsonb_array_elements_text(g.genres) AS genre
      JOIN game_versions gv ON gv.game_id = g.id
      JOIN performance_entries pe ON pe.version_id = gv.id
      WHERE pe.is_removed = false
        AND g.genres IS NOT NULL
      GROUP BY genre
      ORDER BY count DESC
      LIMIT 10
    `)

    // Comment activity per day (last 90 days)
    const commentTimeline = await db.execute(sql`
      SELECT
        DATE(gc.created_at) AS day,
        COUNT(*)::int AS count
      FROM game_comments gc
      WHERE gc.created_at >= ${ninetyDaysAgo}
        AND gc.is_removed = false
      GROUP BY DATE(gc.created_at)
      ORDER BY day ASC
    `)

    return {
      benchmarkTimeline: benchmarkTimeline.rows,
      userTimeline: userTimeline.rows,
      deviceDistribution,
      genrePopularity: genrePopularity.rows,
      commentTimeline: commentTimeline.rows,
    }
  },
)

import { Elysia, t } from "elysia"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/index"
import { user, performanceEntries, games, gameVersions, hardware } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export const userRoutes = new Elysia({ prefix: "/user" })
  .get(
    "/profile/:id",
    async ({ params, set }) => {
      const [profile] = await db
        .select({
          id: user.id,
          name: user.name,
          image: user.image,
          role: user.role,
          createdAt: user.createdAt,
          emailVerified: user.emailVerified,
        })
        .from(user)
        .where(eq(user.id, params.id))
        .limit(1)

      if (!profile) {
        set.status = 404
        return { error: "User not found" }
      }

      // Count contributions (performance entries)
      const [{ count: contributions }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .where(eq(performanceEntries.userId, params.id))

      // Count verified entries
      const [{ count: verifiedEntries }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .where(
          sql`${performanceEntries.userId} = ${params.id} AND ${performanceEntries.verifiedAt} IS NOT NULL`
        )

      // Reputation = contributions * 10 (simple formula for now)
      const reputation = contributions * 10

      const { emailVerified, ...publicProfile } = profile
      return {
        ...publicProfile,
        contributions,
        verifiedEntries,
        reputation,
        verified: emailVerified,
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .get(
    "/me",
    async ({ request, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const [profile] = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          createdAt: user.createdAt,
          emailVerified: user.emailVerified,
        })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1)

      if (!profile) {
        set.status = 404
        return { error: "User not found" }
      }

      const [{ count: contributions }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .where(eq(performanceEntries.userId, session.user.id))

      // Count verified entries
      const [{ count: verifiedEntries }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .where(
          sql`${performanceEntries.userId} = ${session.user.id} AND ${performanceEntries.verifiedAt} IS NOT NULL`
        )

      return {
        ...profile,
        contributions,
        verifiedEntries,
        reputation: contributions * 10,
        verified: profile.emailVerified,
      }
    },
  )
  .get(
    "/me/sessions",
    async ({ request, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const sessions = await auth.api.listSessions({
        headers: request.headers,
      })

      return sessions
    },
  )
  .get(
    "/profile/:id/contributions",
    async ({ params, query, set }) => {
      const [profile] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, params.id))
        .limit(1)

      if (!profile) {
        set.status = 404
        return { error: "User not found" }
      }

      const limit = Math.min(Number(query.limit) || 10, 50)
      const offset = Number(query.offset) || 0

      const entries = await db
        .select({
          id: performanceEntries.id,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          hardwareSlug: performanceEntries.hardwareSlug,
          hardwareName: hardware.name,
          fsrVersion: performanceEntries.fsrVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          verifiedAt: performanceEntries.verifiedAt,
          createdAt: performanceEntries.createdAt,
          gameTitle: games.title,
          gameId: games.id,
          gameHeaderImage: games.headerImage,
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
        .where(eq(performanceEntries.userId, params.id))
        .orderBy(sql`${performanceEntries.createdAt} DESC`)
        .limit(limit)
        .offset(offset)

      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .where(eq(performanceEntries.userId, params.id))

      return {
        data: entries.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
          verifiedAt: e.verifiedAt?.toISOString() ?? null,
        })),
        total,
        limit,
        offset,
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

import { Elysia, t } from "elysia"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/index"
import { user, performanceEntries } from "@/lib/db/schema"
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

      // Reputation = contributions * 10 (simple formula for now)
      const reputation = contributions * 10

      return {
        ...profile,
        contributions,
        reputation,
        verified: profile.emailVerified,
        // Hide email from public profiles
        email: undefined,
        emailVerified: undefined,
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
        .select()
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

      return {
        ...profile,
        contributions,
        reputation: contributions * 10,
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

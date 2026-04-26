import { Elysia, t } from "elysia"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/index"
import { user, performanceEntries, games, gameVersions, hardware, account, passkey } from "@/lib/db/schema"
import { eq, sql, and, desc } from "drizzle-orm"
import { hashPassword } from "better-auth/crypto"

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
        createdAt: publicProfile.createdAt.toISOString(),
        contributions,
        verifiedEntries,
        reputation,
        verified: !!emailVerified,
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
        id: profile.id,
        name: profile.name,
        email: profile.email,
        image: profile.image,
        role: profile.role,
        createdAt: profile.createdAt.toISOString(),
        contributions,
        verifiedEntries,
        reputation: contributions * 10,
        verified: !!profile.emailVerified,
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
    "/me/auth-methods",
    async ({ request, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      // Count accounts by provider
      const accounts = await db
        .select({ providerId: account.providerId, id: account.id })
        .from(account)
        .where(eq(account.userId, session.user.id))

      // Count passkeys
      const [passkeyRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(passkey)
        .where(eq(passkey.userId, session.user.id))

      // Check if user has a password (from accounts where providerId is "credential")
      const hasPassword = accounts.some((a) => a.providerId === "credential")

      // OAuth providers
      const oauthProviders = accounts
        .filter((a) => a.providerId !== "credential")
        .map((a) => ({
          providerId: a.providerId,
          id: a.id,
        }))

      // Total auth methods = passwords + passkeys + oauth accounts
      const totalAuthMethods =
        (hasPassword ? 1 : 0) + (passkeyRow?.count ?? 0) + oauthProviders.length

      return {
        hasPassword,
        passkeyCount: passkeyRow?.count ?? 0,
        oauthProviders,
        totalAuthMethods,
      }
    },
  )
  .post(
    "/me/set-password",
    async ({ request, body, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      // Check if user already has a password
      const existing = await db
        .select({ id: account.id })
        .from(account)
        .where(
          and(
            eq(account.userId, session.user.id),
            eq(account.providerId, "credential")
          )
        )
        .limit(1)

      if (existing.length > 0) {
        set.status = 400
        return { error: "Password already set" }
      }

      const hashed = await hashPassword(body.newPassword)

      await db.insert(account).values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        providerId: "credential",
        accountId: session.user.id,
        password: hashed,
      })

      return { success: true }
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: 8 }),
      }),
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
        .where(and(
          eq(performanceEntries.userId, params.id),
          eq(performanceEntries.isRemoved, false)
        ))
        .orderBy(desc(performanceEntries.createdAt))
        .limit(limit)
        .offset(offset)

      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .where(and(
          eq(performanceEntries.userId, params.id),
          eq(performanceEntries.isRemoved, false)
        ))

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
  // Passkey management endpoints (better-auth doesn't provide these)
  .post(
    "/me/passkey/delete",
    async ({ request, body, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      // Verify the passkey belongs to the user
      const [pk] = await db
        .select({ id: passkey.id })
        .from(passkey)
        .where(and(
          eq(passkey.id, body.id),
          eq(passkey.userId, session.user.id)
        ))
        .limit(1)

      if (!pk) {
        set.status = 404
        return { error: "Passkey not found" }
      }

      await db
        .delete(passkey)
        .where(eq(passkey.id, body.id))

      return { success: true }
    },
    {
      body: t.Object({
        id: t.String(),
      }),
    },
  )
  .post(
    "/me/passkey/update",
    async ({ request, body, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      // Verify the passkey belongs to the user
      const [pk] = await db
        .select({ id: passkey.id })
        .from(passkey)
        .where(and(
          eq(passkey.id, body.id),
          eq(passkey.userId, session.user.id)
        ))
        .limit(1)

      if (!pk) {
        set.status = 404
        return { error: "Passkey not found" }
      }

      await db
        .update(passkey)
        .set({ name: body.name })
        .where(eq(passkey.id, body.id))

      return { success: true }
    },
    {
      body: t.Object({
        id: t.String(),
        name: t.String(),
      }),
    },
  )

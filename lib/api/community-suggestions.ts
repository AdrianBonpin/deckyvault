import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { communitySuggestions, games, user, suggestionStatusEnum } from "@/lib/db/schema"
import { eq, and, desc, sql, ilike } from "drizzle-orm"
import { requireAuth, requireContributorOrAdmin } from "@/lib/auth/guard"

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

async function sendDiscordNotification(suggestion: {
  gameTitle: string
  fieldName: string
  proposedValue: string
  userName: string
}) {
  if (!DISCORD_WEBHOOK_URL) return

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "📝 New Community Suggestion",
            color: 0x5865f2,
            fields: [
              { name: "Game", value: suggestion.gameTitle, inline: true },
              { name: "Field", value: suggestion.fieldName, inline: true },
              {
                name: "Suggested By",
                value: suggestion.userName,
                inline: true,
              },
              {
                name: "Proposed Value",
                value: suggestion.proposedValue.slice(0, 1000),
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })
  } catch (err) {
    console.error("Discord webhook failed:", err)
  }
}

const allowedFields = [
  "title",
  "description",
  "developer",
  "publisher",
  "genres",
  "storeUrl",
  "releaseDate",
]

export const communitySuggestionRoutes = new Elysia({
  prefix: "/community-suggestions",
})

  // Admin list with pagination and filtering
  .get(
    "/admin",
    async ({ query, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const { limit, offset, status } = query

      const conditions = []
      if (status) {
        conditions.push(eq(communitySuggestions.status, status as typeof suggestionStatusEnum.enumValues[number]))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communitySuggestions)
        .leftJoin(games, eq(communitySuggestions.gameId, games.id))
        .leftJoin(user, eq(communitySuggestions.userId, user.id))
        .where(whereClause)

      const data = await db
        .select({
          id: communitySuggestions.id,
          gameId: communitySuggestions.gameId,
          gameTitle: games.title,
          fieldName: communitySuggestions.fieldName,
          currentValue: communitySuggestions.currentValue,
          proposedValue: communitySuggestions.proposedValue,
          reason: communitySuggestions.reason,
          status: communitySuggestions.status,
          createdAt: communitySuggestions.createdAt,
          reviewedAt: communitySuggestions.reviewedAt,
          reviewNote: communitySuggestions.reviewNote,
          userName: user.name,
        })
        .from(communitySuggestions)
        .leftJoin(games, eq(communitySuggestions.gameId, games.id))
        .leftJoin(user, eq(communitySuggestions.userId, user.id))
        .where(whereClause)
        .orderBy(desc(communitySuggestions.createdAt))
        .limit(limit)
        .offset(offset)

      return { data, total: countResult.count, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Number({ default: 20 }),
        offset: t.Number({ default: 0 }),
        status: t.Optional(t.String()),
      }),
    },
  )

  // Submit a suggestion
  .post(
    "/",
    async ({ body, request, set }) => {
      const guard = await requireAuth(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const { gameId, fieldName, proposedValue, reason } = body

      // Validate field name is editable
      if (!allowedFields.includes(fieldName)) {
        set.status = 400
        return { error: `Field '${fieldName}' cannot be suggested` }
      }

      // Get current game value
      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)

      if (!game) {
        set.status = 404
        return { error: "Game not found" }
      }

      // Check for existing pending suggestion on same field
      const [existing] = await db
        .select()
        .from(communitySuggestions)
        .where(
          and(
            eq(communitySuggestions.gameId, gameId),
            eq(communitySuggestions.fieldName, fieldName),
            eq(communitySuggestions.userId, guard.user.id),
            eq(communitySuggestions.status, "pending"),
          ),
        )
        .limit(1)

      if (existing) {
        set.status = 409
        return { error: "You already have a pending suggestion for this field" }
      }

      const currentValue = String((game as Record<string, unknown>)[fieldName] ?? "")

      const [suggestion] = await db
        .insert(communitySuggestions)
        .values({
          gameId,
          userId: guard.user.id,
          fieldName,
          currentValue,
          proposedValue,
          reason,
        })
        .returning()

      // Send Discord notification
      await sendDiscordNotification({
        gameTitle: game.title,
        fieldName,
        proposedValue,
        userName: guard.user.name || "Anonymous",
      })

      return suggestion
    },
    {
      body: t.Object({
        gameId: t.String(),
        fieldName: t.String(),
        proposedValue: t.String(),
        reason: t.Optional(t.String()),
      }),
    },
  )

  // Get suggestions for a game
  .get(
    "/game/:gameId",
    async ({ params, query }) => {
      const status = query.status // optional filter

      const conditions = [eq(communitySuggestions.gameId, params.gameId)]
      if (status) {
        conditions.push(eq(communitySuggestions.status, status as typeof suggestionStatusEnum.enumValues[number]))
      }

      const suggestions = await db
        .select({
          id: communitySuggestions.id,
          fieldName: communitySuggestions.fieldName,
          currentValue: communitySuggestions.currentValue,
          proposedValue: communitySuggestions.proposedValue,
          reason: communitySuggestions.reason,
          status: communitySuggestions.status,
          createdAt: communitySuggestions.createdAt,
          reviewedAt: communitySuggestions.reviewedAt,
          reviewNote: communitySuggestions.reviewNote,
          userName: user.name,
        })
        .from(communitySuggestions)
        .leftJoin(user, eq(communitySuggestions.userId, user.id))
        .where(and(...conditions))
        .orderBy(desc(communitySuggestions.createdAt))

      return suggestions
    },
    {
      params: t.Object({ gameId: t.String() }),
      query: t.Object({
        status: t.Optional(t.String()),
      }),
    },
  )

  // Get all pending suggestions (admin/moderation view)
  .get(
    "/pending",
    async ({ request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const suggestions = await db
        .select({
          id: communitySuggestions.id,
          gameId: communitySuggestions.gameId,
          gameTitle: games.title,
          fieldName: communitySuggestions.fieldName,
          currentValue: communitySuggestions.currentValue,
          proposedValue: communitySuggestions.proposedValue,
          reason: communitySuggestions.reason,
          status: communitySuggestions.status,
          createdAt: communitySuggestions.createdAt,
          userName: user.name,
        })
        .from(communitySuggestions)
        .leftJoin(games, eq(communitySuggestions.gameId, games.id))
        .leftJoin(user, eq(communitySuggestions.userId, user.id))
        .where(eq(communitySuggestions.status, "pending"))
        .orderBy(desc(communitySuggestions.createdAt))

      return suggestions
    },
  )

  // Approve/reject suggestion (admin/contributor)
  .patch(
    "/:suggestionId/review",
    async ({ params, body, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const { status: rawStatus, reviewNote } = body

      if (!["approved", "rejected"].includes(rawStatus)) {
        set.status = 400
        return { error: "Status must be 'approved' or 'rejected'" }
      }

      const status = rawStatus as "approved" | "rejected"

      const [suggestion] = await db
        .select()
        .from(communitySuggestions)
        .where(eq(communitySuggestions.id, params.suggestionId))
        .limit(1)

      if (!suggestion) {
        set.status = 404
        return { error: "Suggestion not found" }
      }

      if (suggestion.status !== "pending") {
        set.status = 400
        return { error: "Suggestion already reviewed" }
      }

      // Update suggestion status
      await db
        .update(communitySuggestions)
        .set({
          status: status as typeof communitySuggestions.$inferInsert.status,
          reviewedBy: guard.user.id,
          reviewedAt: new Date(),
          reviewNote,
        })
        .where(eq(communitySuggestions.id, params.suggestionId))

      // If approved, apply the change to the game
      if (status === "approved") {
        const updateData: Record<string, string> = {}
        updateData[suggestion.fieldName] = suggestion.proposedValue

        await db
          .update(games)
          .set(updateData)
          .where(eq(games.id, suggestion.gameId))
      }

      return { success: true }
    },
    {
      params: t.Object({ suggestionId: t.String() }),
      body: t.Object({
        status: t.String(),
        reviewNote: t.Optional(t.String()),
      }),
    },
  )
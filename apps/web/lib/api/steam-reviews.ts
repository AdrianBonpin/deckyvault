import { Elysia } from "elysia"
import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// In-memory cache for reviews (key -> { data, expires })
const reviewCache = new Map<
  string,
  { data: SteamReviewResponse; expires: number }
>()

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

interface SteamReview {
  recommendationid: string
  author: {
    steamid: string
    num_games_owned: number
    num_reviews: number
    playtime_forever: number
    playtime_last_two_weeks: number
    playtime_at_review: number
    last_played: number
  }
  language: string
  review: string
  timestamp_created: number
  timestamp_updated: number
  voted_up: boolean
  votes_up: number
  votes_funny: number
  comment_count: number
  steam_purchase: boolean
  received_for_free: boolean
  written_during_early_access: boolean
}

interface SteamReviewResponse {
  success: number
  query_summary: {
    num_reviews: number
    review_score_desc: string
    total_positive: number
    total_negative: number
    total_reviews: number
  }
  reviews: SteamReview[]
}

export const steamReviewRoutes = new Elysia({ prefix: "/steam-reviews", detail: { tags: ["Steam"] } })

  // Get embedded Steam reviews for a game
  .get(
    "/:gameId",
    async ({ params, query, set }) => {
      const gameId = params.gameId
      const offset = Number(query.offset) || 0
      const limit = Math.min(Number(query.limit) || 10, 20)
      const language = query.language || "english"

      // Get Steam App ID
      const [game] = await db
        .select({ steamAppId: games.steamAppId })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)

      if (!game?.steamAppId) {
        set.status = 404
        return { error: "Game not found or has no Steam App ID" }
      }

      const cacheKey = `${game.steamAppId}-${language}-${offset}-${limit}`
      const cached = reviewCache.get(cacheKey)
      if (cached && cached.expires > Date.now()) {
        return cached.data
      }

      try {
        // Steam API uses cursor-based pagination, but for simplicity we fetch more and slice
        const response = await fetch(
          `https://store.steampowered.com/appreviews/${game.steamAppId}?json=1&language=${language}&purchase_type=all&num_per_page=${offset + limit}&filter=recent&review_type=all`,
          { signal: AbortSignal.timeout(10000) }
        )

        if (!response.ok) {
          set.status = 502
          return { error: "Failed to fetch Steam reviews" }
        }

        const data: SteamReviewResponse = await response.json()

        // Slice reviews for the requested page
        const slicedData = {
          ...data,
          reviews: (data.reviews ?? []).slice(offset, offset + limit),
        }

        // Cache the result
        reviewCache.set(cacheKey, { data: slicedData, expires: Date.now() + CACHE_TTL })

        return slicedData
      } catch {
        set.status = 502
        return { error: "Steam review API unavailable" }
      }
    }
  )
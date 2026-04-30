import { Elysia } from "elysia"
import { auth } from "@/lib/auth"
import { rateLimit } from "@/lib/auth/rate-limit"
import {
  healthRoutes,
  userRoutes,
  gamesRoutes,
  gameVersionsRoutes,
  gameSyncRoutes,
  hardwareRoutes,
  hardwareStatsRoutes,
  performanceRoutes,
  performanceVerifyRoutes,
  performanceSubmitRoutes,
  commentsRoutes,
  savedGamesRoutes,
  reportRoutes,
  contactRoutes,
  adminReportRoutes,
  adminPerformanceRoutes,
  adminCommentRoutes,
} from "@/lib/api"
import { steamSearchRoutes } from "@/lib/api/steam-search"
import { searchUnifiedRoutes } from "@/lib/api/search-unified"
import { gameStubRoutes } from "@/lib/api/game-stub"
import { gameStatsRoutes } from "@/lib/api/game-stats"
import { gamesManualRoutes } from "@/lib/api/games-manual"
import { compareRoutes } from "@/lib/api/compare"
import { playabilityRoutes } from "@/lib/api/playability"
import { steamReviewRoutes } from "@/lib/api/steam-reviews"
import { gamesListingRoutes } from "@/lib/api/games-listing"
import { steamgridProxyRoutes } from "@/lib/api/steamgrid-proxy"

const betterAuth = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({
          headers,
        })

        if (!session) return status(401)

        return {
          user: session.user,
          session: session.session,
        }
      },
    },
  })

export const app = new Elysia({ prefix: "/api" })
  .onError(({ code, error, set, request }) => {
    console.error(
      `[API Error] ${code} ${request.url}`,
      error instanceof Error ? error.message : error,
    )
    set.status = code === "NOT_FOUND" ? 404 : 500
    return {
      error: code === "NOT_FOUND" ? "Not found" : "Internal server error",
    }
  })
  .use(rateLimit(60, 100))
  .use(betterAuth)
  // Health
  .use(healthRoutes)
  // Users
  .use(userRoutes)
  // Games + Versions
  .use(gamesRoutes)
  .use(gameVersionsRoutes)
  .use(gameSyncRoutes)
  .use(gamesListingRoutes)
  // Hardware
  .use(hardwareRoutes)
  .use(hardwareStatsRoutes)
  // Performance
  .use(performanceRoutes)
  .use(performanceVerifyRoutes)
  .use(performanceSubmitRoutes)
  .use(reportRoutes)
  .use(adminReportRoutes)
  .use(adminPerformanceRoutes)
  .use(adminCommentRoutes)
  // Comments
  .use(commentsRoutes)
  // Steam search proxy
  .use(steamSearchRoutes)
  // Unified search
  .use(searchUnifiedRoutes)
  // Game stub creation
  .use(gameStubRoutes)
  // SteamGridDB proxy
  .use(steamgridProxyRoutes)
  // Game stats aggregation
  .use(gameStatsRoutes)
  // Manual game creation
  .use(gamesManualRoutes)
  // Saved games
  .use(savedGamesRoutes)
  // Contact form
  .use(contactRoutes)
  // Compare
  .use(compareRoutes)
  // Playability
  .use(playabilityRoutes)
  // Steam reviews
  .use(steamReviewRoutes)
  // Root
  .get("/", () => ({
    name: "DeckyVault API",
    version: "2026.0.9",
  }))

export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const DELETE = app.fetch
export const PATCH = app.fetch

export type App = typeof app

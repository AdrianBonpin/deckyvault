import { Elysia } from "elysia"
import { openapi } from "@elysia/openapi"
import { cron, Patterns } from "@elysia/cron"
import { auth } from "@/lib/auth"
import { rateLimit } from "@/lib/auth/rate-limit"
import { taskRegistry } from "./cron"
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
import { adminStorageRoutes } from "@/lib/api/admin-storage"
import { steamSearchRoutes } from "@/lib/api/steam-search"
import { steamdbVersionRoutes } from "@/lib/api/steamdb-version"
import { searchUnifiedRoutes } from "@/lib/api/search-unified"
import { gameStubRoutes } from "@/lib/api/game-stub"
import { gameStatsRoutes } from "@/lib/api/game-stats"
import { gamesPerformanceRoutes } from "@/lib/api/games-performance"
import { gamesManualRoutes } from "@/lib/api/games-manual"
import { compareRoutes } from "@/lib/api/compare"
import { playabilityRoutes } from "@/lib/api/playability"
import { steamReviewRoutes } from "@/lib/api/steam-reviews"
import { communitySuggestionRoutes } from "@/lib/api/community-suggestions"
import { gamesListingRoutes } from "@/lib/api/games-listing"
import { steamgridProxyRoutes } from "@/lib/api/steamgrid-proxy"
import { dashboardRoutes } from "@/lib/api/dashboard"
import { dashboardPublicRoutes } from "@/lib/api/dashboard-public"
import { savedFilterRoutes } from "@/lib/api/saved-filters"
import { cronRoutes } from "@/lib/api/cron"
import { profilePhotoRoutes } from "@/lib/api/profile-photo"
import { screenshotRoutes } from "@/lib/api/screenshots"

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
  .use(
    openapi({
      path: "/openapi",
      embedSpec: true,
      documentation: {
        info: {
          title: "DeckyVault API",
          version: "2026.0.101",
          description:
            "API for DeckyVault — Steam Deck game compatibility, performance reports, and community features.",
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Users", description: "User management" },
          { name: "Games", description: "Games listing and details" },
          { name: "Hardware", description: "Hardware submission and stats" },
          { name: "Performance", description: "Performance reports and verification" },
          { name: "Comments", description: "Game comments" },
          { name: "Reports", description: "User reports" },
          { name: "Admin", description: "Admin-only endpoints" },
          { name: "Steam", description: "Steam proxy endpoints" },
          { name: "Search", description: "Search endpoints" },
          { name: "Contact", description: "Contact form" },
          { name: "Dashboard", description: "Dashboard data" },
          { name: "Cron", description: "Scheduled job triggers" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
    }),
  )
  .use(
    cron({
      name: "orphan_detection",
      pattern: Patterns.EVERY_DAY_AT_2AM,
      async run() {
        const task = taskRegistry.get("orphan_detection")
        if (!task) return
        try {
          const result = await task()
          console.log("[cron] orphan_detection:", result.status, result.details)
        } catch (err) {
          console.error("[cron] orphan_detection failed:", err)
        }
      },
    }),
  )
  .use(
    cron({
      name: "storage_cleanup",
      pattern: Patterns.EVERY_DAY_AT_3AM,
      async run() {
        const task = taskRegistry.get("storage_cleanup")
        if (!task) return
        try {
          const result = await task()
          console.log("[cron] storage_cleanup:", result.status, result.details)
        } catch (err) {
          console.error("[cron] storage_cleanup failed:", err)
        }
      },
    }),
  )
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
  // ── Auth routes (auth rate limit + betterAuth) ──────────────
  .group("", (app) =>
    app
      .use(rateLimit("auth"))
      .use(betterAuth)
      .use(userRoutes)
      .use(profilePhotoRoutes)
  )
  // ── Read-heavy public routes (read rate limit) ───────────────
  .group("", (app) =>
    app
      .use(rateLimit("read"))
      .use(healthRoutes)
      .use(gamesRoutes)
      .use(gameVersionsRoutes)
      .use(gameSyncRoutes)
      .use(gamesListingRoutes)
      .use(hardwareRoutes)
      .use(hardwareStatsRoutes)
      .use(performanceRoutes)
      .use(gameStatsRoutes)
      .use(gamesPerformanceRoutes)
      .use(dashboardRoutes)
      .use(dashboardPublicRoutes)
      .use(playabilityRoutes)
      .use(steamReviewRoutes)
      .use(compareRoutes)
      .use(savedGamesRoutes)
      .use(savedFilterRoutes)
      .use(steamSearchRoutes)
      .use(searchUnifiedRoutes)
      .use(gameStubRoutes)
      .use(steamgridProxyRoutes)
      .use(steamdbVersionRoutes)
      .use(gamesManualRoutes)
      .use(screenshotRoutes)
  )
  // ── Write routes (write rate limit + betterAuth) ─────────────
  .group("", (app) =>
    app
      .use(rateLimit("write"))
      .use(betterAuth)
      .use(performanceVerifyRoutes)
      .use(performanceSubmitRoutes)
      .use(commentsRoutes)
      .use(reportRoutes)
      .use(adminReportRoutes)
      .use(adminPerformanceRoutes)
      .use(adminCommentRoutes)
      .use(adminStorageRoutes)
  )
  // ── Strict rate limit (public forms, no auth) ───────────────
  .group("", (app) =>
    app
      .use(rateLimit("strict"))
      .use(contactRoutes)
      .use(communitySuggestionRoutes)
  )
  // ── Cron (no rate limit) ─────────────────────────────────────
  .use(cronRoutes)
  // ── Root (default rate limit) ────────────────────────────────
  .use(rateLimit("default"))
  .get("/", () => ({
    name: "DeckyVault API",
    version: "2026.0.101",
  }))

export type App = typeof app

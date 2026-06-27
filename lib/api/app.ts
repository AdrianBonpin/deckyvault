import { Elysia, t } from "elysia"
import { openapi } from "@elysia/openapi"
import { cron, Patterns } from "@elysia/cron"
import { auth } from "@/lib/auth"
import { isDeckyVaultEmail, DOMAIN_BLOCK_ERROR } from "@/lib/auth/domain-block"
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
import { adminAnalyticsRoutes } from "@/lib/api/admin-analytics"
import { steamSearchRoutes } from "@/lib/api/steam-search"
import { steamdbVersionRoutes, clientVersionRoutes } from "@/lib/api/steamdb-version"
import { versionTestRoutes, standaloneVersionTestRoutes } from "@/lib/api/version-test"
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
import { loginEmailSchema } from "@/lib/auth/validation"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema/auth"
import { eq } from "drizzle-orm"
import { mobileRoutes } from "@/lib/api/mobile"
import { gamesLookupRoutes } from "@/lib/api/games-lookup"
import { performanceImportRoutes } from "@/lib/api/performance-import"

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
          version: "2026.2.2",
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
          { name: "Mobile", description: "Mobile-optimized consolidated endpoints" },
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
  // ── Auth routes ─────────────────────────────────────────────
  .group("", (app) =>
    app
      .onBeforeHandle(async ({ request, set }) => {
        const url = new URL(request.url)
        const isSignUp =
          url.pathname === "/api/auth/sign-up/email" &&
          request.method === "POST"

        if (!isSignUp) return

        if (process.env.NODE_ENV !== "development") {
          try {
            const cloned = request.clone()
            const body = await cloned.json()
            if (isDeckyVaultEmail(body.email)) {
              console.warn(
                "[AUTH] Blocked sign-up attempt with deckyvault.xyz email",
                body.email,
              )
              set.status = 400
              return { error: DOMAIN_BLOCK_ERROR }
            }
          } catch {
            // Malformed body — let Better Auth reject downstream
          }
        }
      })
      .use(betterAuth)
      .use(userRoutes)
      .use(profilePhotoRoutes)
      .post(
        "/auth/check-email",
        async ({ body, set }) => {
          const result = loginEmailSchema.safeParse(body)
          if (!result.success) {
            set.status = 400
            return { error: result.error.issues[0].message }
          }

          const { email } = result.data
          const existingUser = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, email.toLowerCase()))
            .limit(1)

          return { exists: existingUser.length > 0 }
        },
        {
          body: t.Object({ email: t.String() }),
          response: t.Union([
            t.Object({ exists: t.Boolean() }),
            t.Object({ error: t.String() }),
          ]),
          detail: { hide: true },
        },
      )
  )
  // ── Read-heavy public routes ──────────────────────────────
  .group("", (app) =>
    app
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
      .use(versionTestRoutes)
      .use(standaloneVersionTestRoutes)
      .use(gamesManualRoutes)
      .use(screenshotRoutes)
      .use(gamesLookupRoutes)
      .use(mobileRoutes)
  )
  // ── Write routes ───────────────────────────────────────────
  .group("", (app) =>
    app
      .use(betterAuth)
      .use(clientVersionRoutes)
      .use(performanceVerifyRoutes)
      .use(performanceSubmitRoutes)
      .use(commentsRoutes)
      .use(reportRoutes)
      .use(adminReportRoutes)
      .use(adminPerformanceRoutes)
      .use(adminCommentRoutes)
      .use(adminStorageRoutes)
      .use(performanceImportRoutes)
      .use(adminAnalyticsRoutes)
  )
  // ── Public forms (no auth) ─────────────────────────────────
  .group("", (app) =>
    app
      .use(contactRoutes)
      .use(communitySuggestionRoutes)
  )
  // ── Cron ─────────────────────────────────────────────────────
  .use(cronRoutes)
  // ── Root ────────────────────────────────────────────────────
  .get("/", () => ({
    name: "DeckyVault API",
    version: "2026.2.2",
  }))

export type App = typeof app

import { Elysia } from "elysia"
import { auth } from "@/lib/auth"
import { rateLimit } from "@/lib/auth/rate-limit"
import { healthRoutes } from "@/lib/api/health"
import { userRoutes } from "@/lib/api/user"

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
    console.error(`[API Error] ${code} ${request.url}`,
      error instanceof Error ? error.message : error
    )
    set.status = code === "NOT_FOUND" ? 404 : 500
    return {
      error: code === "NOT_FOUND" ? "Not found" : "Internal server error",
    }
  })
  .use(rateLimit(60, 100))
  .use(betterAuth)
  .use(healthRoutes)
  .use(userRoutes)
  .get("/", () => ({
    name: "DeckyVault API",
    version: "2026.0.1",
  }))

export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const DELETE = app.fetch
export const PATCH = app.fetch

export type App = typeof app

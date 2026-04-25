import { Elysia } from "elysia"
import { healthRoutes } from "@/lib/api/health"

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
  .use(healthRoutes)
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

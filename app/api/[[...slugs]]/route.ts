import { Elysia } from "elysia"
import { healthRoutes } from "@/lib/api/health"

const app = new Elysia({ prefix: "/api" })
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

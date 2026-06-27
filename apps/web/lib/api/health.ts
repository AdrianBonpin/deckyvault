import { Elysia } from "elysia"

export const healthRoutes = new Elysia({
  prefix: "/health",
  detail: { tags: ["Health"] },
}).get(
  "/",
  () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "deckyvault-api",
  }),
  {
    detail: {
      summary: "Health check",
      description: "Returns the current health status of the API.",
    },
  },
)

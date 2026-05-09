import { Elysia } from "elysia"
import { requireAdmin } from "@/lib/auth/guard"
import { generateSitemaps } from "@/lib/sitemap/generate-static"

export const sitemapRegenerateRoutes = new Elysia({ prefix: "/sitemap" })

  .post(
    "/regenerate",
    async ({ request, set }) => {
      const guard = await requireAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      try {
        await generateSitemaps()
        return { success: true, message: "Sitemap regenerated successfully" }
      } catch (err) {
        set.status = 500
        return { error: "Failed to regenerate sitemap", details: err instanceof Error ? err.message : String(err) }
      }
    },
  )
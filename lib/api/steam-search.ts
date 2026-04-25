import { Elysia, t } from "elysia"

interface SteamSearchItem {
  id: number
  name: string
  tiny_image: string
  metascore: string
  platforms: {
    windows: boolean
    mac: boolean
    linux: boolean
  }
}

export const steamSearchRoutes = new Elysia({ prefix: "/search" })
  .get(
    "/steam",
    async ({ query, set }) => {
      if (!query.q || query.q.length < 2) {
        set.status = 400
        return { error: "Query must be at least 2 characters" }
      }

      try {
        const url = new URL("https://store.steampowered.com/api/storesearch/")
        url.searchParams.set("term", query.q)
        url.searchParams.set("cc", "US")
        url.searchParams.set("l", "en")

        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        })

        if (!res.ok) {
          set.status = 502
          return { error: "Failed to fetch from Steam" }
        }

        const data = await res.json()

        return {
          items: (data.items || []).map((item: SteamSearchItem) => ({
            appId: item.id,
            title: item.name,
            image: item.tiny_image,
            platforms: item.platforms,
            metascore: item.metascore,
          })),
          total: data.total || 0,
        }
      } catch (err) {
        console.error("Steam search error:", err)
        set.status = 500
        return { error: "Internal server error" }
      }
    },
    {
      query: t.Object({
        q: t.String(),
      }),
    },
  )

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

export const steamSearchRoutes = new Elysia({ prefix: "/search", detail: { tags: ["Search"] } })
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

        const items: SteamSearchItem[] = (data.items || []).filter(
          (item: SteamSearchItem) => {
            const name = item.name.toLowerCase()
            const exclude = [
              "soundtrack",
              " original soundtrack",
              " ost",
              " - ost",
              "dlc",
              "expansion",
              "season pass",
              " deluxe edition",
              " ultimate edition",
              " premium edition",
              " demo",
              " trial",
              " playtest",
              " beta",
              " artbook",
              " soundtrack bundle",
            ]
            return !exclude.some((kw) => name.includes(kw))
          },
        )

        return {
          items: items.map((item) => ({
            appId: item.id,
            title: item.name,
            image: `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/library_600x900.jpg`,
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

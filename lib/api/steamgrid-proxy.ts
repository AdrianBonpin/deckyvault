import { Elysia, t } from "elysia"

const STEAMGRIDDB_BASE = "https://www.steamgriddb.com/api/v2"

export const steamgridProxyRoutes = new Elysia({ prefix: "/steamgrid", detail: { tags: ["Steam"] } })
  .get(
    "/search",
    async ({ query, set }) => {
      const apiKey = process.env.STEAMGRIDDB_API_KEY
      if (!apiKey) {
        set.status = 503
        return { error: "SteamGridDB API key not configured" }
      }

      try {
        const res = await fetch(
          `${STEAMGRIDDB_BASE}/search/autocomplete/${encodeURIComponent(query.q)}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        )

        if (!res.ok) {
          set.status = res.status
          return { error: "SteamGridDB search failed" }
        }

        const data = await res.json()
        return data
      } catch (err) {
        console.error("SteamGridDB search error:", err)
        set.status = 500
        return { error: "SteamGridDB search failed" }
      }
    },
    {
      query: t.Object({ q: t.String({ minLength: 2 }) }),
    }
  )
  .get(
    "/grids/:gameId",
    async ({ params, query, set }) => {
      const apiKey = process.env.STEAMGRIDDB_API_KEY
      if (!apiKey) {
        set.status = 503
        return { error: "SteamGridDB API key not configured" }
      }

      try {
        const url = new URL(`${STEAMGRIDDB_BASE}/grids/game/${params.gameId}`)
        // Add dimensions filter for capsule-style images
        url.searchParams.set("dimensions", "600x900,342x482")
        if (query.styles) {
          url.searchParams.set("styles", query.styles)
        }

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (!res.ok) {
          set.status = res.status
          return { error: "SteamGridDB grids fetch failed" }
        }

        const data = await res.json()
        return data
      } catch (err) {
        console.error("SteamGridDB grids fetch error:", err)
        set.status = 500
        return { error: "SteamGridDB grids fetch failed" }
      }
    },
    {
      params: t.Object({ gameId: t.String() }),
      query: t.Object({
        styles: t.Optional(t.String()),
      }),
    }
  )
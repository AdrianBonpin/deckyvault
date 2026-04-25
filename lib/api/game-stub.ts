import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

interface SteamAppDetails {
  steam_appid: number
  name: string
  developers?: string[]
  publishers?: string[]
  header_image?: string
  capsule_imagev5?: string
  genres?: { id: string; description: string }[]
  website?: string
}

export const gameStubRoutes = new Elysia({ prefix: "/games" }).post(
  "/stub",
  async ({ body, set }) => {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(games)
      .where(eq(games.steamAppId, body.steamAppId))
      .limit(1)

    if (existing) {
      return { game: existing, created: false }
    }

    // Fetch details from Steam
    let details: SteamAppDetails | null = null
    try {
      const url = new URL("https://store.steampowered.com/api/appdetails/")
      url.searchParams.set("appids", String(body.steamAppId))
      url.searchParams.set("cc", "US")
      url.searchParams.set("l", "en")

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      })

      if (res.ok) {
        const data = (await res.json()) as Record<
          string,
          { success: boolean; data: SteamAppDetails }
        >
        const entry = data[String(body.steamAppId)]
        if (entry?.success) {
          details = entry.data
        }
      }
    } catch (err) {
      console.error("Failed to fetch Steam appdetails:", err)
    }

    const title = details?.name || `Steam App ${body.steamAppId}`
    const developer = details?.developers?.[0] || null
    const publisher = details?.publishers?.[0] || null
    const genres = details?.genres?.map((g) => g.description) || []
    const headerImage = details?.header_image || null
    const capsuleImage =
      details?.capsule_imagev5 || details?.header_image || null

    const [game] = await db
      .insert(games)
      .values({
        steamAppId: body.steamAppId,
        source: "steam",
        title,
        developer,
        publisher,
        genres,
        headerImage,
        capsuleImage,
        storeUrl: `https://store.steampowered.com/app/${body.steamAppId}`,
        lastSync: new Date(),
        syncStatus: "synced",
      })
      .returning()

    set.status = 201
    return { game, created: true }
  },
  {
    body: t.Object({
      steamAppId: t.Number(),
    }),
  },
)

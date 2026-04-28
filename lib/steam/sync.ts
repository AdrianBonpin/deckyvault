import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

interface SteamAppDetails {
  steam_appid: number
  name: string
  developers?: string[]
  publishers?: string[]
  header_image?: string
  genres?: { id: string; description: string }[]
  website?: string
  short_description?: string
  pc_requirements?: { minimum?: string; recommended?: string }
  metacritic?: { score: number; url: string }
  recommendations?: { total: number }
  price_overview?: { currency: string; initial: number; final: number }
  is_free?: boolean
  release_date?: { coming_soon: boolean; date: string }
  categories?: { id: string; description: string }[]
  platforms?: { windows: boolean; mac: boolean; linux: boolean }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function isSyncStale(lastSync: Date | null): boolean {
  if (!lastSync) return true
  return Date.now() - new Date(lastSync).getTime() > SEVEN_DAYS_MS
}

export async function syncSteamGame(steamAppId: number): Promise<void> {
  try {
    const url = new URL("https://store.steampowered.com/api/appdetails/")
    url.searchParams.set("appids", String(steamAppId))
    url.searchParams.set("cc", "US")
    url.searchParams.set("l", "en")

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      console.error(`Steam sync failed for ${steamAppId}: ${res.status}`)
      return
    }

    const data = (await res.json()) as Record<
      string,
      { success: boolean; data: SteamAppDetails }
    >
    const entry = data[String(steamAppId)]

    if (!entry?.success || !entry.data) {
      console.error(`Steam sync: no data for ${steamAppId}`)
      return
    }

    const d = entry.data

    await db
      .update(games)
      .set({
        title: d.name,
        developer: d.developers?.[0] || null,
        publisher: d.publishers?.[0] || null,
        description: d.short_description || null,
        genres: d.genres?.map((g) => g.description) || [],
        headerImage: d.header_image || null,
        capsuleImage: `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`,
        storeUrl: `https://store.steampowered.com/app/${steamAppId}`,
        systemRequirements: d.pc_requirements
          ? { minimum: d.pc_requirements.minimum || null, recommended: d.pc_requirements.recommended || null }
          : null,
        metacriticScore: d.metacritic?.score ?? null,
        metacriticUrl: d.metacritic?.url ?? null,
        recommendationsTotal: d.recommendations?.total ?? null,
        priceCurrent: d.price_overview?.final ?? null,
        priceInitial: d.price_overview?.initial ?? null,
        priceCurrency: d.price_overview?.currency ?? null,
        isFree: d.is_free ?? false,
        releaseDate: d.release_date?.date ?? null,
        categories: d.categories?.map((c) => c.description) ?? null,
        platforms: d.platforms ?? null,
        lastSync: new Date(),
        syncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(eq(games.steamAppId, steamAppId))
  } catch (err) {
    console.error(`Steam sync error for ${steamAppId}:`, err)
  }
}

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
  short_description?: string
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
        capsuleImage: d.capsule_imagev5 || d.header_image || null,
        storeUrl: `https://store.steampowered.com/app/${steamAppId}`,
        lastSync: new Date(),
        syncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(eq(games.steamAppId, steamAppId))
  } catch (err) {
    console.error(`Steam sync error for ${steamAppId}:`, err)
  }
}

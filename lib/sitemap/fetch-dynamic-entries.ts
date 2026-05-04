import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"
import { ne } from "drizzle-orm"
import { validateImageUrl } from "./validate-image-url"

const BASE_URL = "https://deckyvault.xyz"
const MAX_GAME_ENTRIES = 49_700
const MAX_DEVICE_ENTRIES = 200

async function fetchGameEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await db
      .select({
        id: games.id,
        updatedAt: games.updatedAt,
        capsuleImage: games.capsuleImage,
        syncStatus: games.syncStatus,
      })
      .from(games)
      .where(ne(games.syncStatus, "failed"))
      .limit(MAX_GAME_ENTRIES)

    return rows.map((row) => {
      const validatedImage = validateImageUrl(row.capsuleImage)
      return {
        url: `${BASE_URL}/games/${row.id}`,
        lastModified: row.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        ...(validatedImage ? { images: [validatedImage] } : {}),
      }
    })
  } catch {
    return []
  }
}

async function fetchDeviceEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await db
      .select({
        slug: hardware.slug,
        createdAt: hardware.createdAt,
      })
      .from(hardware)
      .limit(MAX_DEVICE_ENTRIES)

    return rows.map((row) => ({
      url: `${BASE_URL}/devices/${row.slug}`,
      lastModified: row.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }))
  } catch {
    return []
  }
}

export async function fetchDynamicEntries(): Promise<{
  gameEntries: MetadataRoute.Sitemap
  deviceEntries: MetadataRoute.Sitemap
}> {
  const [gameEntries, deviceEntries] = await Promise.all([
    fetchGameEntries(),
    fetchDeviceEntries(),
  ])

  return { gameEntries, deviceEntries }
}
import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"
import { or, ne, isNull } from "drizzle-orm"

export const dynamic = "force-dynamic"

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://deckyvault.xyz"

function buildStaticEntries(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/games`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/devices`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/updates`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = buildStaticEntries()

  try {
    const [gameRows, deviceRows] = await Promise.all([
      db
        .select({
          id: games.id,
          updatedAt: games.updatedAt,
          capsuleImage: games.capsuleImage,
        })
        .from(games)
        .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus))),
      db
        .select({
          slug: hardware.slug,
          createdAt: hardware.createdAt,
        })
        .from(hardware),
    ])

    const gameEntries: MetadataRoute.Sitemap = gameRows.map((row) => {
      const image =
        row.capsuleImage &&
        typeof row.capsuleImage === "string" &&
        row.capsuleImage.trim().startsWith("https://") &&
        row.capsuleImage.trim().length <= 2048
          ? row.capsuleImage.trim()
          : undefined

      return {
        url: `${BASE_URL}/game/${row.id}`,
        lastModified: row.updatedAt ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        ...(image ? { images: [image] } : {}),
      }
    })

    const deviceEntries: MetadataRoute.Sitemap = deviceRows.map((row) => ({
      url: `${BASE_URL}/devices/${row.slug}`,
      lastModified: row.createdAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }))

    console.info(
      JSON.stringify({
        event: "sitemap_generated",
        gameCount: gameEntries.length,
        deviceCount: deviceEntries.length,
        staticCount: staticEntries.length,
        totalUrls: staticEntries.length + gameEntries.length + deviceEntries.length,
        generatedAt: new Date().toISOString(),
      }),
    )

    return [...staticEntries, ...gameEntries, ...deviceEntries]
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "sitemap_db_error",
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        generatedAt: new Date().toISOString(),
      }),
    )
    return staticEntries
  }
}

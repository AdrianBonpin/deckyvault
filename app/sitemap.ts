import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"
import { or, ne, isNull } from "drizzle-orm"

const PRODUCTION_URL = "https://deckyvault.xyz"
const MAX_URLS_PER_SITEMAP = 45_000

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  // Never use localhost for sitemaps — they're for production search engines
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "")
  }
  return PRODUCTION_URL
}

const STATIC_ENTRIES: Array<{
  url: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}> = [
  { url: "", changeFrequency: "weekly", priority: 1 },
  { url: "/games", changeFrequency: "daily", priority: 0.8 },
  { url: "/dashboard", changeFrequency: "daily", priority: 0.7 },
  { url: "/devices", changeFrequency: "monthly", priority: 0.6 },
  { url: "/updates", changeFrequency: "weekly", priority: 0.5 },
  { url: "/contact", changeFrequency: "yearly", priority: 0.3 },
]

export async function generateSitemaps(): Promise<{ id: string }[]> {
  const gameCount = await db.$count(
    games,
    or(ne(games.syncStatus, "failed"), isNull(games.syncStatus)),
  )
  const deviceCount = await db.$count(hardware)
  const total = STATIC_ENTRIES.length + gameCount + deviceCount

  const count = Math.ceil(total / MAX_URLS_PER_SITEMAP)
  return Array.from({ length: count }, (_, i) => ({ id: String(i) }))
}

export default async function sitemap({
  id,
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const chunkIndex = Number(id)
  const offset = chunkIndex * MAX_URLS_PER_SITEMAP

  if (chunkIndex === 0) {
    // First chunk: static pages + some games/devices
    const staticEntries: MetadataRoute.Sitemap = STATIC_ENTRIES.map((s) => ({
      url: s.url ? `${baseUrl}${s.url}` : baseUrl,
      changeFrequency: s.changeFrequency,
      priority: s.priority,
    }))

    const remaining = MAX_URLS_PER_SITEMAP - staticEntries.length

    const gameRows = await db
      .select({
        id: games.id,
        updatedAt: games.updatedAt,
        capsuleImage: games.capsuleImage,
      })
      .from(games)
      .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus)))
      .limit(remaining)
      .offset(0)

    const gameEntries: MetadataRoute.Sitemap = gameRows.map((row) => ({
      url: `${baseUrl}/game/${row.id}`,
      lastModified: row.updatedAt ?? undefined,
      changeFrequency: "weekly",
      priority: 0.7,
      ...(row.capsuleImage &&
      typeof row.capsuleImage === "string" &&
      row.capsuleImage.trim().startsWith("https://") &&
      row.capsuleImage.trim().length <= 2048
        ? { images: [row.capsuleImage.trim()] }
        : {}),
    }))

    const stillRemaining = remaining - gameRows.length
    let deviceEntries: MetadataRoute.Sitemap = []

    if (stillRemaining > 0) {
      const deviceRows = await db
        .select({ slug: hardware.slug, createdAt: hardware.createdAt })
        .from(hardware)
        .limit(stillRemaining)
        .offset(0)

      deviceEntries = deviceRows.map((row) => ({
        url: `${baseUrl}/devices/${row.slug}`,
        lastModified: row.createdAt ?? undefined,
        changeFrequency: "monthly",
        priority: 0.5,
      }))
    }

    return [...staticEntries, ...gameEntries, ...deviceEntries]
  }

  // Subsequent chunks: games and devices only
  const gameCount = await db.$count(
    games,
    or(ne(games.syncStatus, "failed"), isNull(games.syncStatus)),
  )
  const dynamicOffset = offset - STATIC_ENTRIES.length

  let allEntries: MetadataRoute.Sitemap = []

  if (dynamicOffset < gameCount) {
    const gameOffset = dynamicOffset
    const gameLimit = Math.min(MAX_URLS_PER_SITEMAP, gameCount - gameOffset)

    const gameRows = await db
      .select({
        id: games.id,
        updatedAt: games.updatedAt,
        capsuleImage: games.capsuleImage,
      })
      .from(games)
      .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus)))
      .limit(gameLimit)
      .offset(gameOffset)

    allEntries = gameRows.map((row) => ({
      url: `${baseUrl}/game/${row.id}`,
      lastModified: row.updatedAt ?? undefined,
      changeFrequency: "weekly",
      priority: 0.7,
      ...(row.capsuleImage &&
      typeof row.capsuleImage === "string" &&
      row.capsuleImage.trim().startsWith("https://") &&
      row.capsuleImage.trim().length <= 2048
        ? { images: [row.capsuleImage.trim()] }
        : {}),
    }))
  }

  const remainingInChunk = MAX_URLS_PER_SITEMAP - allEntries.length
  if (remainingInChunk > 0) {
    const deviceOffset = Math.max(0, dynamicOffset - gameCount)

    const deviceRows = await db
      .select({ slug: hardware.slug, createdAt: hardware.createdAt })
      .from(hardware)
      .limit(remainingInChunk)
      .offset(deviceOffset)

    const deviceEntries = deviceRows.map((row) => ({
      url: `${baseUrl}/devices/${row.slug}`,
      lastModified: row.createdAt ?? undefined,
      changeFrequency: "monthly",
      priority: 0.5,
    }))

    allEntries = [...allEntries, ...deviceEntries]
  }

  return allEntries
}

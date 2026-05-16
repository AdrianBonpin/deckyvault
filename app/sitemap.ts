import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"
import { or, ne, isNull } from "drizzle-orm"

// ── Constants ────────────────────────────────────────────────────────
const PRODUCTION_URL = "https://deckyvault.xyz"

/** Revalidate sitemap every hour via ISR */
export const revalidate = 3600

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "")
  }
  return PRODUCTION_URL
}

// ── Static pages with known priorities ───────────────────────────────
const STATIC_ENTRIES: Array<{
  urlPath: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}> = [
  { urlPath: "", changeFrequency: "weekly", priority: 1 },
  { urlPath: "/games", changeFrequency: "daily", priority: 0.8 },
  { urlPath: "/devices", changeFrequency: "monthly", priority: 0.6 },
  { urlPath: "/updates", changeFrequency: "weekly", priority: 0.5 },
  { urlPath: "/contact", changeFrequency: "yearly", priority: 0.3 },
]

// ── Default export: build the sitemap ────────────────────────────────
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()

  // Static pages
  const staticEntries: MetadataRoute.Sitemap = STATIC_ENTRIES.map((s) => ({
    url: s.urlPath ? `${baseUrl}${s.urlPath}` : baseUrl,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }))

  // Game pages
  const gameRows = await db
    .select({
      id: games.id,
      updatedAt: games.updatedAt,
      capsuleImage: games.capsuleImage,
    })
    .from(games)
    .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus)))

  const gameEntries: MetadataRoute.Sitemap = gameRows.map((row) => ({
    url: `${baseUrl}/game/${row.id}`,
    lastModified: row.updatedAt ?? undefined,
    changeFrequency: "weekly" as const,
    priority: 0.7,
    ...buildImageEntry(row.capsuleImage),
  }))

  // Device pages
  const deviceRows = await db
    .select({ slug: hardware.slug, createdAt: hardware.createdAt })
    .from(hardware)

  const deviceEntries: MetadataRoute.Sitemap = deviceRows.map((row) => ({
    url: `${baseUrl}/devices/${row.slug}`,
    lastModified: row.createdAt ?? undefined,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }))

  return [...staticEntries, ...gameEntries, ...deviceEntries]
}

// ── Helpers ──────────────────────────────────────────────────────────
/** Build a valid image sitemap entry from a capsule image URL */
function buildImageEntry(
  capsuleImage: unknown,
): { images: string[] } | Record<string, never> {
  if (
    typeof capsuleImage === "string" &&
    capsuleImage.trim().startsWith("https://") &&
    capsuleImage.trim().length <= 2048
  ) {
    return { images: [capsuleImage.trim()] }
  }
  return {}
}
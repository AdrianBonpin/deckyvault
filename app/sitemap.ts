import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"
import { or, ne, isNull } from "drizzle-orm"
import { getAllUpdates } from "@/lib/updates"
import {
  getBaseUrl,
  imageEntry,
  toDate,
  querySafe,
  STATIC_PAGES,
} from "@/lib/sitemap-utils"

/** Revalidate sitemap every hour via ISR */
export const revalidate = 3600

/** Maximum entries per individual child sitemap */
const MAX_ENTRIES = 45_000

/** Threshold for game pagination — split into per-page child sitemaps */
const GAMES_PER_SITEMAP = 5_000

// ─── Sitemap Index Generator ────────────────────────────────────────

/**
 * Returns the list of child sitemap IDs. Next.js auto-generates
 * the sitemap index at /sitemap.xml from this.
 */
export async function generateSitemaps(): Promise<{ id: string }[]> {
  const ids: { id: string }[] = [
    { id: "static" },
    { id: "devices" },
    { id: "updates" },
  ]

  // Determine if games need pagination
  try {
    const countResult = await querySafe("game-count", () =>
      db
        .select({ count: games.id })
        .from(games)
        .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus))),
    )
    const count = countResult?.[0]?.count ?? 0
    if (count > GAMES_PER_SITEMAP) {
      const pages = Math.ceil(count / GAMES_PER_SITEMAP)
      for (let i = 0; i < pages; i++) {
        ids.push({ id: `games-${i}` })
      }
    } else {
      ids.push({ id: "games" })
    }
  } catch {
    // Fall back to single unpaginated games sitemap
    ids.push({ id: "games" })
  }

  return ids
}

// ─── Child Sitemap Generator ────────────────────────────────────────

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id

  if (id === "static") {
    return generateStaticSitemap()
  }

  if (id === "games" || id.startsWith("games-")) {
    return generateGamesSitemap(id)
  }

  if (id === "devices") {
    return generateDevicesSitemap()
  }

  if (id === "updates") {
    return generateUpdatesSitemap()
  }

  // Unknown sitemap ID — return empty but valid
  console.warn(`[Sitemap] Unknown child sitemap ID: "${id}"`)
  return []
}

// ─── Individual Generators ──────────────────────────────────────────

/**
 * Static pages sitemap — no DB dependency.
 * Returns the core browse/utility pages with a fixed lastModified.
 */
async function generateStaticSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  // Use a constant "build date" — updated with each deploy
  const buildDate = new Date()

  return STATIC_PAGES.map((page) => ({
    url: page.urlPath ? `${baseUrl}${page.urlPath}` : baseUrl,
    lastModified: buildDate,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))
}

/**
 * Games child sitemap — DB-backed with ISR caching.
 * Supports pagination: 'games' (unpaginated) or 'games-0', 'games-1', etc.
 */
async function generateGamesSitemap(
  id: string,
): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()

  // Parse pagination: 'games-0' → page 0, 'games' (no suffix) → page 0
  const pageMatch = id.match(/^games-(\d+)$/)
  const page = pageMatch ? parseInt(pageMatch[1], 10) : 0
  const offset = page * GAMES_PER_SITEMAP

  const rows = await querySafe("games", () =>
    db
      .select({
        id: games.id,
        updatedAt: games.updatedAt,
        capsuleImage: games.capsuleImage,
      })
      .from(games)
      .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus))),
  )

  if (!rows) return []

  const entries: MetadataRoute.Sitemap = []

  for (const row of rows) {
    if (entries.length >= MAX_ENTRIES) break
    entries.push({
      url: `${baseUrl}/game/${row.id}`,
      lastModified: toDate(row.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      ...imageEntry(row.capsuleImage),
    })
  }

  // Apply pagination slice
  const sliced = entries.slice(offset, offset + GAMES_PER_SITEMAP)
  return sliced
}

/**
 * Devices child sitemap — DB-backed with ISR caching.
 */
async function generateDevicesSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()

  const rows = await querySafe("hardware", () =>
    db
      .select({
        slug: hardware.slug,
        createdAt: hardware.createdAt,
      })
      .from(hardware),
  )

  if (!rows) return []

  const entries: MetadataRoute.Sitemap = []

  for (const row of rows) {
    if (entries.length >= MAX_ENTRIES) break
    entries.push({
      url: `${baseUrl}/devices/${row.slug}`,
      lastModified: toDate(row.createdAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })
  }

  return entries
}

/**
 * Updates child sitemap — filesystem-backed with ISR caching.
 */
async function generateUpdatesSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()

  let updates: ReturnType<typeof getAllUpdates>
  try {
    updates = getAllUpdates()
  } catch (err) {
    console.error("[Sitemap] Failed to load updates:", err)
    return []
  }

  const entries: MetadataRoute.Sitemap = []

  for (const update of updates) {
    if (entries.length >= MAX_ENTRIES) break
    entries.push({
      url: `${baseUrl}/updates/${update.slug}`,
      lastModified: toDate(update.date),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })
  }

  return entries
}
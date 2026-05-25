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

/** Maximum entries per sitemap (Google's limit is 50k; we stay well under) */
const MAX_ENTRIES = 45_000

// ─── Sitemap builder (called by Next.js on every request + ISR) ────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const entries: MetadataRoute.Sitemap = []

  // ── 1. Static pages ────────────────────────────────────────────────
  for (const page of STATIC_PAGES) {
    entries.push({
      url: page.urlPath ? `${baseUrl}${page.urlPath}` : baseUrl,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })
  }

  // ── 2. Game detail pages (from database) ───────────────────────────
  const gameRows = await querySafe("games", () =>
    db
      .select({
        id: games.id,
        updatedAt: games.updatedAt,
        capsuleImage: games.capsuleImage,
      })
      .from(games)
      .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus))),
  )

  if (gameRows) {
    for (const row of gameRows) {
      if (entries.length >= MAX_ENTRIES) break
      entries.push({
        url: `${baseUrl}/game/${row.id}`,
        lastModified: toDate(row.updatedAt),
        changeFrequency: "weekly",
        priority: 0.8,
        ...imageEntry(row.capsuleImage),
      })
    }
  }

  // ── 3. Device detail pages (from database) ─────────────────────────
  const deviceRows = await querySafe("hardware", () =>
    db
      .select({
        slug: hardware.slug,
        createdAt: hardware.createdAt,
      })
      .from(hardware),
  )

  if (deviceRows) {
    for (const row of deviceRows) {
      if (entries.length >= MAX_ENTRIES) break
      entries.push({
        url: `${baseUrl}/devices/${row.slug}`,
        lastModified: toDate(row.createdAt),
        changeFrequency: "monthly",
        priority: 0.6,
      })
    }
  }

  // ── 4. Update / changelog detail pages (from markdown files) ───────
  try {
    const updates = getAllUpdates()
    for (const update of updates) {
      if (entries.length >= MAX_ENTRIES) break
      entries.push({
        url: `${baseUrl}/updates/${update.slug}`,
        lastModified: toDate(update.date),
        changeFrequency: "monthly",
        priority: 0.5,
      })
    }
  } catch (err) {
    console.error("[Sitemap] Failed to load updates:", err)
  }

  return entries
}

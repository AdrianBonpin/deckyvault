import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"
import { or, ne, isNull } from "drizzle-orm"
import { getAllUpdates } from "@/lib/updates"

// ─── Configuration ─────────────────────────────────────────────────────

const PRODUCTION_URL = "https://deckyvault.xyz"

/** Revalidate sitemap every hour via ISR */
export const revalidate = 3600

/** Maximum entries per sitemap (Google's limit is 50k; we stay well under) */
const MAX_ENTRIES = 45_000

// ─── Helpers ────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "")
  }
  return PRODUCTION_URL
}

/** Build a valid image sitemap entry from a capsule image URL */
function imageEntry(
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

/** Safely extract a Date from a value that could be Date, string, or nullish */
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return undefined
}

/**
 * Run a DB query with a safety net.
 * Returns rows on success, undefined on failure — the sitemap still
 * renders with whatever data is available.
 */
async function querySafe<T>(
  label: string,
  query: () => Promise<T>,
  timeoutMs = 15_000,
): Promise<T | undefined> {
  try {
    const result = await Promise.race([
      query(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[Sitemap] ${label} query timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ])
    return result
  } catch (err) {
    console.error(`[Sitemap] ${label} query failed:`, err)
    return undefined
  }
}

// ─── Static page definitions ───────────────────────────────────────────

interface StaticPageDef {
  urlPath: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}

const STATIC_PAGES: StaticPageDef[] = [
  // Homepage
  { urlPath: "", changeFrequency: "weekly", priority: 1.0 },
  // Core browse pages
  { urlPath: "/games", changeFrequency: "daily", priority: 0.9 },
  { urlPath: "/devices", changeFrequency: "weekly", priority: 0.7 },
  { urlPath: "/updates", changeFrequency: "weekly", priority: 0.6 },
  // Utility pages
  { urlPath: "/compare", changeFrequency: "weekly", priority: 0.5 },
  { urlPath: "/search", changeFrequency: "monthly", priority: 0.3 },
  // Static content
  { urlPath: "/contact", changeFrequency: "yearly", priority: 0.3 },
]

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

import type { MetadataRoute } from "next"

// ─── Configuration ─────────────────────────────────────────────────────

export const PRODUCTION_URL = "https://deckyvault.xyz"

// ─── Helpers ───────────────────────────────────────────────────────────

export function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "")
  }
  return PRODUCTION_URL
}

/** Build a valid image sitemap entry from a capsule image URL */
export function imageEntry(
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
export function toDate(value: unknown): Date | undefined {
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
export async function querySafe<T>(
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

export interface StaticPageDef {
  urlPath: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}

export const STATIC_PAGES: StaticPageDef[] = [
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
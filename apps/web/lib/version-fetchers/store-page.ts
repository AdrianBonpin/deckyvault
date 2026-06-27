/**
 * Strategy 2: Steam Store Page Scraping
 *
 * Fetches the store.steampowered.com/app/{appid} HTML page and extracts
 * version/build info from embedded JavaScript data, JSON-LD structured data,
 * and meta tags.
 *
 * Designed for client-side use (uses the browser's IP to avoid server-wide rate limits).
 * Server-side calls may be rate-limited by Steam.
 */
import type { VersionFetchResult } from "./types"

const STORE_URL = "https://store.steampowered.com/app"

export async function fetchStorePage(
  steamAppId: number,
): Promise<VersionFetchResult> {
  const source = "Store Page Scrape"

  try {
    const res = await fetch(`${STORE_URL}/${steamAppId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return {
        versionString: null,
        buildId: null,
        source,
        success: false,
        error: `HTTP ${res.status}`,
      }
    }

    const html = await res.text()

    let versionString: string | null = null
    let buildId: string | null = null

    // ── Extract from JSON-LD structured data ──────────────────
    const ldJsonMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
    )
    if (ldJsonMatch) {
      try {
        const ld = JSON.parse(ldJsonMatch[1])
        // Look for version in SoftwareApplication schema
        if (ld.version && typeof ld.version === "string") {
          versionString = ld.version
        }
        // Sometimes build info is in description or other fields
        if (ld.description && !versionString) {
          const verMatch = ld.description.match(
            /(?:version|build)\s*[:#]?\s*([\d.]+[\w.]*)/i,
          )
          if (verMatch) versionString = verMatch[1]
        }
      } catch {
        // JSON-LD parse failure — non-fatal
      }
    }

    // ── Extract from embedded JS data objects ─────────────────
    // Pattern: g_rgAssetData, g_rgAppData, etc.
    const jsDataPatterns = [
      /(?:g_rgAppData|g_rgAssetData|g_rgDepotData)\s*=\s*(\{[\s\S]*?\});/gi,
      /data-ds-appdata\s*=\s*['"]([^'"]+)['"]/gi,
    ]

    for (const pattern of jsDataPatterns) {
      const match = pattern.exec(html)
      if (match) {
        try {
          const data = JSON.parse(match[1])
          // Search for version/build in nested objects
          const found = findVersionInObject(data)
          if (found.versionString && !versionString)
            versionString = found.versionString
          if (found.buildId && !buildId) buildId = found.buildId
        } catch {
          // Non-fatal
        }
      }
    }

    // ── Extract from meta tags ────────────────────────────────
    if (!versionString) {
      const metaVersion = html.match(
        /<meta[^>]+name="[^"]*version[^"]*"[^>]+content="([^"]+)"/i,
      )
      if (metaVersion) versionString = metaVersion[1]
    }

    // ── Extract build ID from image URLs ──────────────────────
    // The ?t= timestamp in header image URLs changes with each update
    if (!buildId) {
      const imgMatch = html.match(
        /header\.jpg\?t=(\d{9,10})/i,
      )
      if (imgMatch) {
        // This is a timestamp, not a build ID per se, but it changes with updates
        // Use it as a build-ish identifier
        buildId = imgMatch[1]
      }
    }

    // ── Extract version from changelog/update sections ────────
    if (!versionString) {
      // Look for "Update X.Y" or "Patch X.Y" in the page text
      const updateMatch = html.match(
        /(?:Update|Patch|Version)\s+(\d+\.\d+(?:\.\d+)?(?:[a-z]\d*)?)/i,
      )
      if (updateMatch) versionString = updateMatch[1]
    }

    const success = !!(versionString || buildId)
    return {
      versionString,
      buildId,
      source,
      success,
      error: success ? undefined : "No version data found on store page",
    }
  } catch (err) {
    return {
      versionString: null,
      buildId: null,
      source,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/** Recursively search an object for version/build strings */
function findVersionInObject(
  obj: unknown,
  depth = 0,
): { versionString: string | null; buildId: string | null } {
  if (depth > 4 || !obj || typeof obj !== "object") {
    return { versionString: null, buildId: null }
  }

  const record = obj as Record<string, unknown>
  let versionString: string | null = null
  let buildId: string | null = null

  const versionKeys = [
    "version",
    "clientversion",
    "gameversion",
    "app_version",
    "displayVersion",
  ]
  const buildKeys = [
    "buildid",
    "build_id",
    "build",
    "app_build",
    "publicbuild",
  ]

  for (const key of Object.keys(record)) {
    const val = record[key]
    if (typeof val === "string") {
      const lowerKey = key.toLowerCase()
      if (
        !versionString &&
        versionKeys.some((k) => lowerKey.includes(k)) &&
        /^\d+\.\d+/.test(val)
      ) {
        versionString = val
      }
      if (
        !buildId &&
        buildKeys.some((k) => lowerKey.includes(k)) &&
        /^\d{3,10}$/.test(val)
      ) {
        buildId = val
      }
    }
    if (typeof val === "number" && val > 1000 && val < 99999999) {
      const lowerKey = key.toLowerCase()
      if (!buildId && buildKeys.some((k) => lowerKey.includes(k))) {
        buildId = String(val)
      }
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = findVersionInObject(val, depth + 1)
      if (!versionString) versionString = nested.versionString
      if (!buildId) buildId = nested.buildId
    }
  }

  return { versionString, buildId }
}

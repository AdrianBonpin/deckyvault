/**
 * Strategy 4: Steam Store API (appdetails) + Heuristics
 *
 * Uses the public store.steampowered.com/api/appdetails endpoint (no API key).
 * While it doesn't directly contain version/build IDs, we can extract:
 * - The ?t= cache-busting timestamp from image URLs (changes with updates)
 * - Release date information
 * - Any version hints in the game description
 */
import type { VersionFetchResult } from "./types"

const APPDETAILS_URL = "https://store.steampowered.com/api/appdetails"

interface AppDetailsResponse {
  [appId: string]: {
    success: boolean
    data?: {
      name: string
      header_image?: string
      release_date?: {
        coming_soon: boolean
        date: string
      }
      detailed_description?: string
      about_the_game?: string
      // Steam may include additional fields
      [key: string]: unknown
    }
  }
}

export async function fetchStoreApi(
  steamAppId: number,
): Promise<VersionFetchResult> {
  const source = "Store API Heuristic"

  try {
    const res = await fetch(
      `${APPDETAILS_URL}?appids=${steamAppId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!res.ok) {
      return {
        versionString: null,
        buildId: null,
        source,
        success: false,
        error: `HTTP ${res.status}`,
      }
    }

    const data: AppDetailsResponse = await res.json()
    const appData = data[String(steamAppId)]

    if (!appData?.success || !appData.data) {
      return {
        versionString: null,
        buildId: null,
        source,
        success: false,
        error: "App not found or not available",
      }
    }

    const { data: details } = appData

    let versionString: string | null = null
    let buildId: string | null = null

    // ── Extract timestamp from header_image URL ────────────────
    // e.g. header.jpg?t=1749053861 — changes with every game update
    if (details.header_image) {
      const tsMatch = details.header_image.match(/\?t=(\d{9,10})/)
      if (tsMatch) {
        buildId = tsMatch[1]
      }
    }

    // ── Search description for version mentions ────────────────
    const textToSearch = [
      details.about_the_game,
      details.detailed_description,
    ]
      .filter(Boolean)
      .join(" ")

    if (textToSearch) {
      // Strip HTML tags
      const cleanText = textToSearch.replace(/<[^>]+>/g, " ")

      // Look for version patterns in description
      const versionPatterns = [
        /(?:version|patch|update)\s*[:#]?\s*(\d+\.\d+(?:\.\d+)?(?:[a-z]\d*)?)/i,
        /v?(\d+\.\d+\.\d+(?:[a-z]\d*)?)/i,
      ]

      for (const pattern of versionPatterns) {
        const match = cleanText.match(pattern)
        if (match) {
          versionString = match[1]
          break
        }
      }
    }

    const success = !!(versionString || buildId)
    return {
      versionString,
      buildId,
      source,
      success,
      error: success
        ? undefined
        : "No version hints found in store API data",
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

/**
 * Strategy 3: Steam Community Hub Scraping
 *
 * Fetches steamcommunity.com/app/{appid} and extracts version/build info
 * from update announcements, embedded data, and the app sidebar.
 *
 * Community hub is less aggressively rate-limited than the store.
 */
import type { VersionFetchResult } from "./types"

const COMMUNITY_URL = "https://steamcommunity.com/app"

export async function fetchCommunityHub(
  steamAppId: number,
): Promise<VersionFetchResult> {
  const source = "Community Hub Scrape"

  try {
    const res = await fetch(`${COMMUNITY_URL}/${steamAppId}`, {
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

    // ── Extract from embedded community data ──────────────────
    // The community hub embeds JSON in data attributes
    const communityDataMatch = html.match(
      /data-community="([^"]+)"/i,
    )
    if (communityDataMatch) {
      try {
        const decoded = communityDataMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
        const data = JSON.parse(decoded)
        // Community data usually has CLANSTEAMID, APPID, IS_OGG, etc.
        // Not version info, but checked for completeness
        if (data.APPID && !buildId) {
          // APPID is just the same app ID — not useful
        }
      } catch {
        // Non-fatal
      }
    }

    // ── Extract from "View Stats" link ────────────────────────
    // Sometimes game stats pages have more info

    // ── Parse update announcements for version numbers ────────
    // Look for patterns like "Counter-Strike 2 Update" or "Game Update 1.4.2"
    const updateTitlePatterns = [
      // "Game Name Update" — generic, skip
      // "Update 1.4.2" pattern
      /(?:Update|Patch)\s+(\d+\.\d+(?:\.\d+)?(?:[a-z]\d*)?)/gi,
      // "Version 1.4.2" pattern
      /Version\s+(\d+\.\d+(?:\.\d+)?(?:[a-z]\d*)?)/gi,
      // "Build 12345678" pattern
      /Build\s+(\d{5,10})/gi,
    ]

    for (const pattern of updateTitlePatterns) {
      const match = pattern.exec(html)
      if (match) {
        const val = match[1]
        if (/^\d{5,10}$/.test(val)) {
          if (!buildId) buildId = val
        } else if (/^\d+\.\d+/.test(val)) {
          if (!versionString) versionString = val
        }
      }
    }

    // ── Extract build ID from JS globals ──────────────────────
    const buildTimestampMatch = html.match(
      /"BUILD_TIMESTAMP"[:\s]+(\d{9,10})/,
    )
    if (buildTimestampMatch && !buildId) {
      // BUILD_TIMESTAMP is the page build time, not game build
      // But if we have nothing else, it's a signal
      // Skipping — too noisy
    }

    // ── Try apphub sidebar for build/version info ──────────────
    const apphubMatch = html.match(
      /apphub_AppInfo[^>]*>([\s\S]*?)<\/div>/i,
    )
    if (apphubMatch) {
      const apphubHtml = apphubMatch[1]
      // Look for "Build ID" or "Current version" labels
      const buildLabelMatch = apphubHtml.match(
        /Build\s*ID[:\s]*<\/span>\s*([\d,]+)/i,
      )
      if (buildLabelMatch && !buildId) {
        buildId = buildLabelMatch[1].replace(/,/g, "")
      }

      const versionLabelMatch = apphubHtml.match(
        /(?:Current|Latest)\s*Version[:\s]*<\/span>\s*([\d.]+)/i,
      )
      if (versionLabelMatch && !versionString) {
        versionString = versionLabelMatch[1]
      }
    }

    const success = !!(versionString || buildId)
    return {
      versionString,
      buildId,
      source,
      success,
      error: success ? undefined : "No version data found on community hub",
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

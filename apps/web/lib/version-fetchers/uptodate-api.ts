/**
 * Strategy 1: Steam UpToDateCheck API
 *
 * Uses the public ISteamApps/UpToDateCheck endpoint (no API key required).
 * Primarily works for Valve games with dedicated servers (CS2, TF2, Dota 2, etc.).
 *
 * Returns:
 * - required_version: numeric version (used as buildId fallback)
 * - message: sometimes contains a named version like "1.41.6.1"
 *
 * Non-Valve games typically return { success: false }.
 */
import type { VersionFetchResult } from "./types"

const UPTODATE_URL =
  "https://api.steampowered.com/ISteamApps/UpToDateCheck/v1"

interface UpToDateResponse {
  response: {
    success: boolean
    up_to_date?: boolean
    version_is_listable?: boolean
    required_version?: number
    message?: string
    error?: string
  }
}

export async function fetchUpToDateCheck(
  steamAppId: number,
): Promise<VersionFetchResult> {
  const source = "UpToDateCheck API"

  try {
    const res = await fetch(
      `${UPTODATE_URL}?appid=${steamAppId}&version=0`,
      {
        headers: {
          "User-Agent": "DeckyVault/1.0 (deckyvault.xyz; game version lookup)",
        },
        signal: AbortSignal.timeout(8000),
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

    const data: UpToDateResponse = await res.json()

    if (!data.response.success) {
      return {
        versionString: null,
        buildId: null,
        source,
        success: false,
        error: data.response.error ?? "App not supported",
      }
    }

    let versionString: string | null = null
    let buildId: string | null = null

    // Extract named version from message
    // e.g. "Server version required: 1.41.6.1" → "1.41.6.1"
    if (data.response.message) {
      const namedMatch = data.response.message.match(
        /(?:version|required)[:\s]+([\d.]+)/i,
      )
      if (namedMatch) {
        versionString = namedMatch[1]
      }
    }

    // Use required_version as buildId
    if (data.response.required_version) {
      buildId = String(data.response.required_version)
    }

    const success = !!(versionString || buildId)
    return {
      versionString,
      buildId,
      source,
      success,
      error: success ? undefined : "No version data in response",
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

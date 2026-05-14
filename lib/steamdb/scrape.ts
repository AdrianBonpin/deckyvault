import { getCachedVersion, setCachedVersion, isOnCooldown, setCooldown, setExtendedCooldown } from "./cache"

const STEAMDB_APP_URL = "https://steamdb.info/app"

interface ScrapeResult {
  versionString: string | null
  buildId: string | null
}

export async function scrapeSteamDBVersion(steamAppId: number): Promise<ScrapeResult & { cached: boolean }> {
  // Check cache first
  const cached = getCachedVersion(steamAppId)
  if (cached) {
    return { versionString: cached.versionString, buildId: cached.buildId, cached: true }
  }

  // Check cooldown
  if (isOnCooldown(steamAppId)) {
    return { versionString: null, buildId: null, cached: true }
  }

  // If scraping is disabled via env, skip
  if (process.env.STEAMDB_SCRAPING_ENABLED === "false") {
    return { versionString: null, buildId: null, cached: true }
  }

  try {
    const res = await fetch(`${STEAMDB_APP_URL}/${steamAppId}/`, {
      headers: {
        "User-Agent": "DeckyVault/1.0 (deckyvault.xyz; game version lookup)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (res.status === 429 || res.status === 403) {
      setExtendedCooldown(steamAppId)
      return { versionString: null, buildId: null, cached: true }
    }

    if (!res.ok) {
      setCooldown(steamAppId, 30)
      return { versionString: null, buildId: null, cached: true }
    }

    const html = await res.text()
    const result = parseSteamDBHtml(html)

    setCachedVersion(steamAppId, result.versionString, result.buildId)
    return { ...result, cached: false }
  } catch {
    setCooldown(steamAppId, 30)
    return { versionString: null, buildId: null, cached: true }
  }
}

function parseSteamDBHtml(html: string): ScrapeResult {
  let versionString: string | null = null
  let buildId: string | null = null

  // Strategy 1: Look for "Last known name" in meta or table rows
  const lastKnownMatch = html.match(/Last known name[^<]*<[^>]*>([^<]+)</i)
  if (lastKnownMatch) {
    versionString = lastKnownMatch[1].trim()
  }

  // Strategy 2: Try JSON-LD for version
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  if (jsonLdMatch) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1])
      if (parsed.version) {
        versionString = versionString || parsed.version
      }
    } catch {
      // JSON-LD parse failure is non-fatal
    }
  }

  // Strategy 3: Extract build ID from the page
  const buildMatch = html.match(/Build\s*ID[^<]*<\/td>\s*<td[^>]*>(\d+)/i)
     || html.match(/buildid[^>]*>(\d+)/i)
  if (buildMatch) {
    buildId = buildMatch[1].trim()
  }

  return { versionString, buildId }
}

// Export for testing
export const _parseSteamDBHtml = parseSteamDBHtml
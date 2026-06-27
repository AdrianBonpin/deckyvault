/**
 * Version Fetcher Orchestrator
 *
 * Tries multiple strategies to fetch game version/build info without a Steam API key.
 *
 * Strategies (tried in order):
 * 1. UpToDateCheck API    — Fastest, works for Valve dedicated-server games
 * 2. Store Page Scrape    — Extracts from embedded JS/JSON-LD on store page
 * 3. Community Hub Scrape — Extracts from community hub update announcements
 * 4. Store API Heuristic  — Uses store API + header image timestamps
 *
 * The first strategy that returns a versionString wins.
 * If no strategy returns a versionString, we fall back to the first strategy
 * that returns a buildId.
 *
 * Client-side preferred strategies (2, 3, 4) should be called from the browser
 * to avoid server-wide rate limiting. Strategy 1 (UpToDateCheck) is safe
 * for server-side use.
 */
import type { VersionFetchResult, VersionFetchStrategy } from "./types"
import { fetchUpToDateCheck } from "./uptodate-api"
import { fetchStorePage } from "./store-page"
import { fetchCommunityHub } from "./community-hub"
import { fetchStoreApi } from "./store-api"

export type { VersionFetchResult, VersionFetchStrategy }

/** All available strategies */
export const ALL_STRATEGIES: Array<{
  name: string
  fn: VersionFetchStrategy
  /** If true, this strategy should be called from the client (browser), not server */
  preferClient: boolean
}> = [
  { name: "UpToDateCheck API", fn: fetchUpToDateCheck, preferClient: false },
  { name: "Store Page Scrape", fn: fetchStorePage, preferClient: true },
  { name: "Community Hub Scrape", fn: fetchCommunityHub, preferClient: true },
  { name: "Store API Heuristic", fn: fetchStoreApi, preferClient: true },
]

/** Server-safe strategies (won't trigger rate limits on server IP) */
export const SERVER_STRATEGIES = ALL_STRATEGIES.filter((s) => !s.preferClient)

/** Client-side strategies (use browser IP to avoid server-wide rate limits) */
export const CLIENT_STRATEGIES = ALL_STRATEGIES.filter((s) => s.preferClient)

/**
 * Run all strategies and return the best result.
 *
 * Priority:
 * 1. Result with versionString
 * 2. Result with buildId
 * 3. First failure
 */
export async function fetchAllVersions(
  steamAppId: number,
  strategies = ALL_STRATEGIES,
): Promise<{
  /** Best combined result */
  best: VersionFetchResult
  /** Individual results from each strategy */
  all: VersionFetchResult[]
  /** Which strategy produced the best result */
  bestSource: string
}> {
  const results = await Promise.all(
    strategies.map((s) => s.fn(steamAppId)),
  )

  // Find best: prefer versionString > buildId > nothing
  let best: VersionFetchResult = results[0]

  for (const result of results) {
    if (result.versionString && !best.versionString) {
      best = result
    }
    if (!best.versionString && !best.buildId && result.buildId) {
      best = result
    }
  }

  return {
    best,
    all: results,
    bestSource: best.source,
  }
}

/**
 * Run a single strategy by name.
 */
export async function fetchVersionByStrategy(
  steamAppId: number,
  strategyName: string,
): Promise<VersionFetchResult> {
  const strategy = ALL_STRATEGIES.find(
    (s) => s.name === strategyName,
  )
  if (!strategy) {
    return {
      versionString: null,
      buildId: null,
      source: strategyName,
      success: false,
      error: `Unknown strategy: ${strategyName}`,
    }
  }
  return strategy.fn(steamAppId)
}

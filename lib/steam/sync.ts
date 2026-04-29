import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

interface SteamAppDetails {
  steam_appid: number
  name: string
  developers?: string[]
  publishers?: string[]
  header_image?: string
  genres?: { id: string; description: string }[]
  website?: string
  short_description?: string
  pc_requirements?: { minimum?: string; recommended?: string }
  metacritic?: { score: number; url: string }
  recommendations?: { total: number }
  price_overview?: { currency: string; initial: number; final: number }
  is_free?: boolean
  release_date?: { coming_soon: boolean; date: string }
  categories?: { id: string; description: string }[]
  platforms?: { windows: boolean; mac: boolean; linux: boolean }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_RETRY_DELAY_MS = SEVEN_DAYS_MS

export function isSyncStale(lastSync: Date | null): boolean {
  if (!lastSync) return true
  return Date.now() - new Date(lastSync).getTime() > SEVEN_DAYS_MS
}

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchSteamGridDBCover(gameTitle: string): Promise<string | null> {
  try {
    const apiKey = process.env.STEAMGRIDDB_API_KEY;
    if (!apiKey) return null;

    // Search for game
    const searchRes = await fetch(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameTitle)}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) }
    );
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    if (!searchData.data || searchData.data.length === 0) return null;

    const gameId = searchData.data[0].id;

    // Get grids
    const gridsRes = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/game/${gameId}?dimensions=600x900,342x482`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) }
    );
    if (!gridsRes.ok) return null;

    const gridsData = await gridsRes.json();
    if (!gridsData.data || gridsData.data.length === 0) return null;

    return gridsData.data[0].url;
  } catch {
    return null;
  }
}

export async function syncSteamGame(
  steamAppId: number,
  options?: { forceRetry?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if recently synced (unless forceRetry)
    if (!options?.forceRetry) {
      const existing = await db
        .select({ lastSync: games.lastSync, syncStatus: games.syncStatus, syncNextRetry: games.syncNextRetry })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1);

      if (existing.length > 0 && existing[0].lastSync) {
        const nextRetry = existing[0].syncNextRetry ? new Date(existing[0].syncNextRetry) : null;
        if (nextRetry && nextRetry.getTime() > Date.now()) {
          return { success: false, error: "Sync skipped: next retry not yet reached" };
        }
        if (!isSyncStale(existing[0].lastSync)) {
          return { success: false, error: "Sync skipped: recently synced" };
        }
      }
    }

    // Fetch from Steam API with timeout
    const url = new URL("https://store.steampowered.com/api/appdetails/")
    url.searchParams.set("appids", String(steamAppId))
    url.searchParams.set("cc", "US")
    url.searchParams.set("l", "en")

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errorMsg = `Steam API returned ${res.status}`
      // Get current retry count for exponential backoff
      const [currentGame] = await db
        .select({ retryCount: games.syncRetryCount })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1)
      const retryCount = (currentGame?.retryCount ?? 0) + 1
      const backoffMs = Math.min(ONE_HOUR_MS * Math.pow(2, retryCount - 1), MAX_RETRY_DELAY_MS)
      await db
        .update(games)
        .set({
          syncError: errorMsg,
          syncRetryCount: retryCount,
          syncNextRetry: new Date(Date.now() + backoffMs),
          updatedAt: new Date(),
        })
        .where(eq(games.steamAppId, steamAppId))
      return { success: false, error: errorMsg }
    }

    const data = (await res.json()) as Record<
      string,
      { success: boolean; data: SteamAppDetails }
    >
    const entry = data[String(steamAppId)]

    if (!entry?.success || !entry.data) {
      const errorMsg = `No data returned from Steam for app ${steamAppId}`
      // Get current retry count for exponential backoff
      const [currentGame] = await db
        .select({ retryCount: games.syncRetryCount })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1)
      const retryCount = (currentGame?.retryCount ?? 0) + 1
      const backoffMs = Math.min(ONE_HOUR_MS * Math.pow(2, retryCount - 1), MAX_RETRY_DELAY_MS)
      await db
        .update(games)
        .set({
          syncError: errorMsg,
          syncRetryCount: retryCount,
          syncNextRetry: new Date(Date.now() + backoffMs),
          updatedAt: new Date(),
        })
        .where(eq(games.steamAppId, steamAppId))
      return { success: false, error: errorMsg }
    }

    const d = entry.data

    // Build capsule image URL and validate it
    const capsuleUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`
    let finalCapsuleUrl: string | null = capsuleUrl

    const imageValid = await validateImageUrl(capsuleUrl)
    if (!imageValid) {
      // Fall back to SteamGridDB
      const fallbackUrl = await fetchSteamGridDBCover(d.name)
      finalCapsuleUrl = fallbackUrl || null
    }

    // Update database with all fields including error tracking
    await db
      .update(games)
      .set({
        title: d.name,
        developer: d.developers?.[0] || null,
        publisher: d.publishers?.[0] || null,
        description: d.short_description || null,
        genres: d.genres?.map((g) => g.description) || [],
        headerImage: d.header_image || null,
        capsuleImage: finalCapsuleUrl,
        storeUrl: `https://store.steampowered.com/app/${steamAppId}`,
        systemRequirements: d.pc_requirements
          ? { minimum: d.pc_requirements.minimum || null, recommended: d.pc_requirements.recommended || null }
          : null,
        metacriticScore: d.metacritic?.score ?? null,
        metacriticUrl: d.metacritic?.url ?? null,
        recommendationsTotal: d.recommendations?.total ?? null,
        priceCurrent: d.price_overview?.final ?? null,
        priceInitial: d.price_overview?.initial ?? null,
        priceCurrency: d.price_overview?.currency ?? null,
        isFree: d.is_free ?? false,
        releaseDate: d.release_date?.date ?? null,
        categories: d.categories?.map((c) => c.description) ?? null,
        platforms: d.platforms ?? null,
        lastSync: new Date(),
        syncStatus: "synced",
        syncError: null,
        syncRetryCount: 0,
        syncNextRetry: null,
        updatedAt: new Date(),
      })
      .where(eq(games.steamAppId, steamAppId))

    return { success: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    try {
      // Get current retry count for exponential backoff
      const [currentGame] = await db
        .select({ retryCount: games.syncRetryCount })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1)
      const retryCount = (currentGame?.retryCount ?? 0) + 1
      const backoffMs = Math.min(ONE_HOUR_MS * Math.pow(2, retryCount - 1), MAX_RETRY_DELAY_MS)
      await db
        .update(games)
        .set({
          syncError: errorMsg,
          syncRetryCount: retryCount,
          syncNextRetry: new Date(Date.now() + backoffMs),
          updatedAt: new Date(),
        })
        .where(eq(games.steamAppId, steamAppId))
    } catch {
      // If DB update fails too, just log it
      console.error(`Failed to update error tracking for ${steamAppId}`)
    }
    return { success: false, error: errorMsg }
  }
}
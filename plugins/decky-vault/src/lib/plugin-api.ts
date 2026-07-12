import { pluginGet } from "./api"

export interface PluginEntry {
  id: string
  hardwareSlug: string
  fpsAvg: number
  fpsLow: number | null
  fpsOnePercentLow: number | null
  fpsHigh: number | null
  upscalerType: string
  frameGenMethod: string
  protonVersion: string | null
  osVersion: string | null
  tdpWatts: number | null
  settingsJson: unknown
  upvotes: number
  isPinned: boolean
  createdAt: string
  userName: string | null
  userImage: string | null
}

export interface PluginGameResponse {
  game: { id: string; steamAppId: number | null; title: string; slug: string | null } | null
  estFps: { avg: number; low: number | null; onePct: number | null; high: number | null; count: number; tdpAvg: number | null } | null
  topEntries: PluginEntry[]
  recentEntries: PluginEntry[]
  error?: string
}

export interface PluginDeviceRow {
  slug: string
  name: string
  count: number
}

// Tiny per-appId cache (1h TTL)
interface CacheEntry { value: PluginGameResponse; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60 * 60 * 1000
const settingsRef: { baseUrl: string } = { baseUrl: "https://deckyvault.xyz" }

export function setPluginApiBaseUrl(url: string) {
  settingsRef.baseUrl = url || "https://deckyvault.xyz"
}

export async function fetchPluginGame(
  steamAppId: number,
  hardware: string | null,
  limit: number,
): Promise<PluginGameResponse> {
  const key = `${steamAppId}|${hardware ?? "all"}|${limit}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  const path = `/plugin/game/${steamAppId}?limit=${limit}${hardware ? `&hardware=${encodeURIComponent(hardware)}` : ""}`
  const raw = await pluginGet(path, settingsRef.baseUrl)
  const value = raw as unknown as PluginGameResponse
  // Don't cache error responses — transient failures shouldn't poison the cache
  if (!raw.error) {
    cache.set(key, { value, expires: Date.now() + TTL_MS })
  }
  return value
}

export async function fetchPluginDevices(steamAppId: number): Promise<PluginDeviceRow[]> {
  const raw = await pluginGet(`/plugin/game/${steamAppId}/devices`, settingsRef.baseUrl)
  if (raw.error) return []
  return (raw.devices as PluginDeviceRow[]) ?? []
}

export function clearPluginCache(steamAppId?: number) {
  if (steamAppId == null) { cache.clear(); return }
  for (const k of cache.keys()) {
    if (k.startsWith(`${steamAppId}|`)) cache.delete(k)
  }
}
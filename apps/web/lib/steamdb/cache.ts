interface CachedVersion {
  versionString: string | null
  buildId: string | null
  fetchedAt: number
}

const cache = new Map<number, CachedVersion>()
const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export function getCachedVersion(steamAppId: number): CachedVersion | null {
  const entry = cache.get(steamAppId)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(steamAppId)
    return null
  }
  return entry
}

export function setCachedVersion(
  steamAppId: number,
  versionString: string | null,
  buildId: string | null,
): void {
  cache.set(steamAppId, {
    versionString,
    buildId,
    fetchedAt: Date.now(),
  })
}

// Cooldown tracking for failed fetches
const cooldowns = new Map<number, number>()

export function isOnCooldown(steamAppId: number): boolean {
  const until = cooldowns.get(steamAppId)
  if (!until) return false
  if (Date.now() > until) {
    cooldowns.delete(steamAppId)
    return false
  }
  return true
}

export function setCooldown(steamAppId: number, minutes: number = 30): void {
  cooldowns.set(steamAppId, Date.now() + minutes * 60 * 1000)
}

export function setExtendedCooldown(steamAppId: number): void {
  cooldowns.set(steamAppId, Date.now() + 24 * 60 * 60 * 1000) // 24 hours
}
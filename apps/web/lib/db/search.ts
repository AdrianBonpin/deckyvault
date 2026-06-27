/**
 * Normalizes a raw search query so that common word separators
 * (spaces, hyphens, underscores, colons, dots) are treated equivalently.
 *
 * Replaces any sequence of separator chars with a single `%` ILIKE wildcard,
 * then wraps the whole pattern in `%…%`.
 *
 * Example:
 *   fuzzySearchTerm("counter strike")  → "%counter%strike%"
 *   fuzzySearchTerm("counter-strike")  → "%counter%strike%"
 *
 * Both will match "Counter-Strike", "Counter Strike", "Counter_Strike", etc.
 */
export function fuzzySearchTerm(rawQuery: string): string {
  const normalized = rawQuery.replace(/[-_\s:.]+/g, "%")
  return `%${normalized}%`
}
/**
 * Validates an image URL for sitemap use.
 * Returns `null` for invalid inputs, otherwise returns the trimmed HTTPS URL.
 */
export function validateImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null

  const trimmed = url.trim()
  if (trimmed.length === 0) return null

  if (!trimmed.startsWith("https://")) return null

  if (trimmed.length > 2048) return null

  return trimmed
}
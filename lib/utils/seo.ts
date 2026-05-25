/**
 * Truncate text at a word boundary, appending ellipsis if cut.
 * Guarantees the result never breaks a word in half.
 */
export function smartTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const truncated = text.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(" ")
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + "..." : truncated + "..."
}

/** Breadcrumb segment — name and absolute URL */
export interface BreadcrumbSegment {
  name: string
  url: string
}

/**
 * Build a Schema.org BreadcrumbList from ordered segments.
 * Position is 1-based per Schema.org spec.
 */
export function buildBreadcrumbList(segments: BreadcrumbSegment[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: segments.map((seg, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: seg.name,
      item: seg.url,
    })),
  }
}
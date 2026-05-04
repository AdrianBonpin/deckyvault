import type { MetadataRoute } from "next"

const BASE_URL = "https://deckyvault.xyz"

/**
 * Builds static sitemap entries for publicly-indexable pages.
 *
 * Auth pages (`/login`, `/signup`) are intentionally excluded because
 * they provide no indexable content. Search engines should not surface
 * authentication flows as standalone results.
 *
 * Also excluded: `/manage` (admin dashboard, noindex), `/search`
 * (parameterized results, no canonical representation), `/profile`
 * (user-specific), `/compare` (parameterized tool), and any `/api/*`
 * routes (robots.txt disallow).
 */
export function buildStaticEntries(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/games`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/devices`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/updates`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
  ]
}

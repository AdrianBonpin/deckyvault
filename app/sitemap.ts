import type { MetadataRoute } from "next"
import { buildStaticEntries } from "@/lib/sitemap/build-static-entries"
import { fetchDynamicEntries } from "@/lib/sitemap/fetch-dynamic-entries"

/**
 * ISR-style revalidation window in seconds.
 *
 * Next.js caches the sitemap and regenerates it at most once per
 * revalidation window. Between regenerations, the cached response
 * is served instantly from memory (and from Cloudflare's edge via
 * the `s-maxage` directive).
 *
 * On-demand purging is handled by `/api/revalidate-sitemap` which
 * calls `revalidatePath("/sitemap.xml")`.
 */
export const revalidate = Number(process.env.SITEMAP_REVALIDATE_SECONDS) || 3600

/**
 * Generates the sitemap for deckyvault.xyz.
 *
 * Combines static pages with dynamic game and device entries from
 * the database. The result is cached by Next.js with ISR semantics
 * so crawlers always get a fast response even during cold starts
 * (the cache is persisted to disk in self-hosted Docker setups).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = buildStaticEntries()
  const { gameEntries, deviceEntries } = await fetchDynamicEntries()
  return [...staticEntries, ...gameEntries, ...deviceEntries]
}

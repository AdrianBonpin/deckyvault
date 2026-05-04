import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"
import { buildStaticEntries } from "@/lib/sitemap/build-static-entries"
import { fetchDynamicEntries } from "@/lib/sitemap/fetch-dynamic-entries"

const REVALIDATE_SECONDS = Number(process.env.SITEMAP_REVALIDATE_SECONDS) || 3600

/**
 * Caches the full sitemap generation with time-based revalidation.
 *
 * Instead of `force-dynamic` (which hits the DB on every crawler request),
 * we use `unstable_cache` so the sitemap is regenerated at most once per
 * revalidation window. This keeps response times fast for crawlers while
 * still reflecting recent changes on the site.
 *
 * Tagged with `"sitemap"` so the on-demand revalidation webhook can
 * clear this cache immediately after content changes.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/unstable_cache
 */
const getCachedSitemap = unstable_cache(
  async () => {
    const staticEntries = buildStaticEntries()
    const { gameEntries, deviceEntries } = await fetchDynamicEntries()
    return [...staticEntries, ...gameEntries, ...deviceEntries]
  },
  ["sitemap"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: ["sitemap"],
  },
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getCachedSitemap()
}

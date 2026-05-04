import type { MetadataRoute } from "next"
import { buildStaticEntries } from "@/lib/sitemap/build-static-entries"
import { fetchDynamicEntries } from "@/lib/sitemap/fetch-dynamic-entries"

/**
 * ISR revalidation interval for the sitemap.
 *
 * Instead of `force-dynamic`, we use ISR so the sitemap is cached and
 * regenerated in the background. This keeps response times fast for
 * crawlers while still reflecting recent changes on the site.
 */
export const revalidate = Number(process.env.SITEMAP_REVALIDATE_SECONDS) || 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = buildStaticEntries()
  const { gameEntries, deviceEntries } = await fetchDynamicEntries()

  return [...staticEntries, ...gameEntries, ...deviceEntries]
}

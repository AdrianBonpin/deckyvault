import { generateSitemaps } from "@/app/sitemap"
import { getBaseUrl } from "@/lib/sitemap-utils"

export const revalidate = 3600

export async function GET() {
  const baseUrl = getBaseUrl()
  const sitemaps = await generateSitemaps()

  const entries = sitemaps
    .map(({ id }) => `  <sitemap>\n    <loc>${baseUrl}/sitemap/${id}.xml</loc>\n  </sitemap>`)
    .join("\n")

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entries,
    `</sitemapindex>`,
  ].join("\n")

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
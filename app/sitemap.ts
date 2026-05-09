// Static sitemap is generated at build time and served from /public/sitemap.xml
// This file is intentionally left as a redirect to the static file.
// Run `npm run build:sitemap` before `npm run build` to regenerate.
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  // Static sitemap is served from /public/sitemap.xml
  // This function is no longer used for dynamic sitemap generation
  return []
}
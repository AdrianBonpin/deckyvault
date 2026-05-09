import fs from "fs"
import path from "path"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"
import { or, ne, isNull } from "drizzle-orm"

const PRODUCTION_URL = "https://deckyvault.xyz"

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  // Never use localhost for sitemaps — they're for production search engines
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "")
  }
  return PRODUCTION_URL
}

const BASE_URL = getBaseUrl()
const MAX_URLS_PER_SITEMAP = 45000 // Leave buffer below 50k limit

interface SitemapEntry {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
  "image:image"?: {
    "image:loc": string
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function buildStaticEntries(): SitemapEntry[] {
  return [
    { loc: BASE_URL, changefreq: "weekly", priority: 1.0 },
    { loc: `${BASE_URL}/games`, changefreq: "daily", priority: 0.8 },
    { loc: `${BASE_URL}/dashboard`, changefreq: "daily", priority: 0.7 },
    { loc: `${BASE_URL}/devices`, changefreq: "monthly", priority: 0.6 },
    { loc: `${BASE_URL}/updates`, changefreq: "weekly", priority: 0.5 },
    { loc: `${BASE_URL}/contact`, changefreq: "yearly", priority: 0.3 },
  ]
}

function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    let xml = `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n`
    if (entry.lastmod) xml += `    <lastmod>${entry.lastmod}</lastmod>\n`
    if (entry.changefreq) xml += `    <changefreq>${entry.changefreq}</changefreq>\n`
    if (entry.priority) xml += `    <priority>${entry.priority}</priority>\n`
    if (entry["image:image"]) {
      xml += `    <image:image>\n      <image:loc>${escapeXml(entry["image:image"]["image:loc"])}</image:loc>\n    </image:image>\n`
    }
    xml += `  </url>`
    return xml
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>`
}

function renderSitemapIndex(sitemaps: { loc: string; lastmod: string }[]): string {
  const entries = sitemaps.map((s) => {
    return `  <sitemap>\n    <loc>${escapeXml(s.loc)}</loc>\n    <lastmod>${s.lastmod}</lastmod>\n  </sitemap>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`
}

async function generateSitemaps() {
  console.log("Generating static sitemaps...")

  // Fetch games
  const gameRows = await db
    .select({
      id: games.id,
      updatedAt: games.updatedAt,
      capsuleImage: games.capsuleImage,
    })
    .from(games)
    .where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus)))

  // Fetch devices
  const deviceRows = await db
    .select({
      slug: hardware.slug,
      createdAt: hardware.createdAt,
    })
    .from(hardware)

  console.log(`Found ${gameRows.length} games and ${deviceRows.length} devices`)

  // Build game entries
  const gameEntries: SitemapEntry[] = gameRows.map((row) => {
    const image =
      row.capsuleImage &&
      typeof row.capsuleImage === "string" &&
      row.capsuleImage.trim().startsWith("https://") &&
      row.capsuleImage.trim().length <= 2048
        ? row.capsuleImage.trim()
        : undefined

    return {
      loc: `${BASE_URL}/game/${row.id}`,
      lastmod: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      changefreq: "weekly",
      priority: 0.7,
      ...(image ? { "image:image": { "image:loc": image } } : {}),
    }
  })

  // Build device entries
  const deviceEntries: SitemapEntry[] = deviceRows.map((row) => ({
    loc: `${BASE_URL}/devices/${row.slug}`,
    lastmod: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    changefreq: "monthly",
    priority: 0.5,
  }))

  // Static entries
  const staticEntries = buildStaticEntries()

  const now = new Date().toISOString()
  const publicDir = path.join(process.cwd(), "public")

  // Ensure public dir exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  // Decide: single file or sitemap index
  const allDynamicEntries = [...gameEntries, ...deviceEntries]
  const needsIndex = (staticEntries.length + allDynamicEntries.length) > MAX_URLS_PER_SITEMAP

  if (needsIndex) {
    // Write static sitemap
    const staticXml = renderSitemap(staticEntries)
    fs.writeFileSync(path.join(publicDir, "sitemap-static.xml"), staticXml)

    // Write device sitemap
    const deviceXml = renderSitemap(deviceEntries)
    fs.writeFileSync(path.join(publicDir, "sitemap-devices.xml"), deviceXml)

    // Split game entries into chunks
    const chunks: SitemapEntry[][] = []
    for (let i = 0; i < gameEntries.length; i += MAX_URLS_PER_SITEMAP) {
      chunks.push(gameEntries.slice(i, i + MAX_URLS_PER_SITEMAP))
    }

    const sitemaps: { loc: string; lastmod: string }[] = [
      { loc: `${BASE_URL}/sitemap-static.xml`, lastmod: now },
      { loc: `${BASE_URL}/sitemap-devices.xml`, lastmod: now },
    ]

    chunks.forEach((chunk, i) => {
      const filename = `sitemap-games-${i}.xml`
      const xml = renderSitemap(chunk)
      fs.writeFileSync(path.join(publicDir, filename), xml)
      sitemaps.push({ loc: `${BASE_URL}/${filename}`, lastmod: now })
    })

    // Write sitemap index
    const indexXml = renderSitemapIndex(sitemaps)
    fs.writeFileSync(path.join(publicDir, "sitemap.xml"), indexXml)
  } else {
    // Single sitemap
    const allEntries = [...staticEntries, ...gameEntries, ...deviceEntries]
    const xml = renderSitemap(allEntries)
    fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml)
  }

  console.log(`Sitemaps generated successfully! Total URLs: ${staticEntries.length + allDynamicEntries.length}`)
}

// Run if called directly (CLI execution, not module import)
const isCliRun = typeof process !== "undefined" && process.argv?.[1]?.includes("generate-static")
if (isCliRun) {
  generateSitemaps().catch((err) => {
    console.error("Failed to generate sitemaps:", err)
    process.exit(1)
  })
}

export { generateSitemaps }